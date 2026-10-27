// src/app/api/agendamentos/[id]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { z } from "zod";

export const runtime = "edge";

const roleSchema = z.enum(["owner", "manager", "barber", "receptionist"]);
const statusSchema = z.enum([
  "scheduled", "in_progress", "completed", "canceled", "awaiting_payment", "no_show",
]);

const updateAppointmentSchema = z.object({
  status: statusSchema.optional(),
  client_name: z.string().trim().min(1).optional(),
  client_phone: z.string().nullable().optional(),
  scheduled_at: z.string().datetime().optional(),
  barber_id: z.string().uuid().optional(),
  service_ids: z.array(z.string().uuid()).optional().refine(
    (ids) => ids === undefined || new Set(ids).size === ids.length,
    { message: "A lista de serviços contém IDs duplicados." },
  ),
  duration_minutes: z.number().positive().optional(),
}).refine((data) => Object.keys(data).some((key) => key !== "duration_minutes"), {
  message: "Nenhum dado válido fornecido para atualização.",
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteParams) {
  try {
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: "Identificador de agendamento inválido." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const rawBody = await request.json().catch(() => null);
    const bodyValidation = updateAppointmentSchema.safeParse(rawBody);
    if (!bodyValidation.success) {
      return NextResponse.json({
        error: "Dados inválidos fornecidos.",
        details: bodyValidation.error.format(),
      }, { status: 400 });
    }

    const payloadAtualizacao = { ...bodyValidation.data };
    const serviceIdsToUpdate = payloadAtualizacao.service_ids;
    delete payloadAtualizacao.service_ids;
    delete payloadAtualizacao.duration_minutes;

    const { data: member, error: memberError } = await supabase
      .from("barbershop_members")
      .select("barbershop_id, role")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (memberError) {
      console.error("[PATCH_ROLE_ERROR]", memberError);
      return NextResponse.json({ error: "Não foi possível verificar as permissões do usuário." }, { status: 500 });
    }
    if (!member) {
      return NextResponse.json({ error: "Acesso negado à barbearia." }, { status: 403 });
    }

    const roleParse = roleSchema.safeParse(member.role);
    if (!roleParse.success) {
      return NextResponse.json({ error: "O perfil do usuário não possui uma função autorizada." }, { status: 403 });
    }

    const userRole = roleParse.data;
    // Preserva a regra existente nesta rota: recepcionistas podem administrar a agenda da barbearia.
    const isManagerOrOwner = userRole === "owner" || userRole === "manager" || userRole === "receptionist";

    const { data: existingAppt, error: checkError } = await supabase
      .from("appointments")
      .select("id, barber_id, barbershop_id")
      .eq("id", id)
      .maybeSingle();

    if (checkError) {
      console.error("[PATCH_APPOINTMENT_LOOKUP_ERROR]", checkError);
      return NextResponse.json({ error: "Não foi possível consultar o agendamento." }, { status: 500 });
    }
    if (!existingAppt) {
      return NextResponse.json({ error: "Agendamento não encontrado." }, { status: 404 });
    }
    if (existingAppt.barbershop_id !== member.barbershop_id) {
      return NextResponse.json({ error: "Acesso negado a este agendamento." }, { status: 403 });
    }

    if (!isManagerOrOwner) {
      const { data: myStaff, error: staffError } = await supabase
        .from("staff")
        .select("id")
        .eq("profile_id", user.id)
        .eq("barbershop_id", member.barbershop_id)
        .maybeSingle();

      if (staffError) {
        console.error("[PATCH_STAFF_LOOKUP_ERROR]", staffError);
        return NextResponse.json({ error: "Não foi possível verificar o profissional associado ao usuário." }, { status: 500 });
      }
      if (!myStaff) {
        return NextResponse.json({ error: "Não há um cadastro profissional associado a este usuário." }, { status: 403 });
      }

      // appointments.barber_id referencia staff.id, e não auth.users.id.
      if (existingAppt.barber_id !== myStaff.id) {
        return NextResponse.json({ error: "Você só pode alterar os seus próprios agendamentos." }, { status: 403 });
      }
      if (payloadAtualizacao.barber_id !== undefined && payloadAtualizacao.barber_id !== existingAppt.barber_id) {
        return NextResponse.json({ error: "Você não tem permissão para alterar o profissional responsável." }, { status: 403 });
      }
    }

    // Se houver transferência, o destino precisa estar ativo e na mesma barbearia.
    if (isManagerOrOwner && payloadAtualizacao.barber_id !== undefined) {
      const { data: targetStaff, error: targetStaffError } = await supabase
        .from("staff")
        .select("id")
        .eq("id", payloadAtualizacao.barber_id)
        .eq("barbershop_id", member.barbershop_id)
        .eq("is_active", true)
        .in("role", ["owner", "manager", "barber"])
        .maybeSingle();

      if (targetStaffError) {
        console.error("[PATCH_TARGET_STAFF_ERROR]", targetStaffError);
        return NextResponse.json({ error: "Não foi possível validar o profissional de destino." }, { status: 500 });
      }
      if (!targetStaff) {
        return NextResponse.json({ error: "O profissional selecionado não existe, está inativo ou não pertence a esta barbearia." }, { status: 400 });
      }
    }

    // Impede associar serviços de outra barbearia ao agendamento.
    if (serviceIdsToUpdate !== undefined && serviceIdsToUpdate.length > 0) {
      const { data: validServices, error: servicesValidationError } = await supabase
        .from("services")
        .select("id")
        .eq("barbershop_id", member.barbershop_id)
        .in("id", serviceIdsToUpdate);

      if (servicesValidationError) {
        console.error("[PATCH_SERVICES_VALIDATION_ERROR]", servicesValidationError);
        return NextResponse.json({ error: "Não foi possível validar os serviços selecionados." }, { status: 500 });
      }
      if ((validServices?.length ?? 0) !== serviceIdsToUpdate.length) {
        return NextResponse.json({ error: "Um ou mais serviços não pertencem a esta barbearia." }, { status: 400 });
      }
    }

    let updatedData: unknown = existingAppt;

    // Permite atualizar somente os serviços sem enviar um UPDATE vazio para appointments.
    if (Object.keys(payloadAtualizacao).length > 0) {
      const { data: appointmentData, error: updateError } = await supabase
        .from("appointments")
        .update(payloadAtualizacao)
        .eq("id", id)
        .eq("barbershop_id", member.barbershop_id)
        .select()
        .maybeSingle();

      if (updateError) {
        console.error("[PATCH_UPDATE_DB_ERROR]", updateError);
        return NextResponse.json({ error: `Falha ao atualizar na base de dados: ${updateError.message}` }, { status: 400 });
      }
      if (!appointmentData) {
        return NextResponse.json({ error: "O agendamento não foi atualizado ou não está acessível." }, { status: 404 });
      }

      updatedData = appointmentData;
    }

    if (serviceIdsToUpdate !== undefined) {
      const { error: deletePivotError } = await supabase
        .from("appointment_services")
        .delete()
        .eq("appointment_id", id);

      if (deletePivotError) {
        console.error("[PATCH_DELETE_PIVOT_ERROR]", deletePivotError);
        return NextResponse.json({ error: "Falha ao limpar os serviços anteriores do agendamento." }, { status: 500 });
      }

      if (serviceIdsToUpdate.length > 0) {
        const pivotData = serviceIdsToUpdate.map((serviceId) => ({ appointment_id: id, service_id: serviceId }));
        const { error: insertPivotError } = await supabase.from("appointment_services").insert(pivotData);
        if (insertPivotError) {
          console.error("[PATCH_INSERT_PIVOT_ERROR]", insertPivotError);
          return NextResponse.json({ error: "Falha ao registrar os novos serviços no agendamento." }, { status: 500 });
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedData,
      message: "Agendamento atualizado com sucesso.",
    }, { status: 200 });
  } catch (error: unknown) {
    console.error("[PATCH_FATAL_ERROR]", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteParams) {
  try {
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: "Identificador de agendamento inválido." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { data: member, error: memberError } = await supabase
      .from("barbershop_members")
      .select("barbershop_id, role")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (memberError) {
      console.error("[DELETE_ROLE_ERROR]", memberError);
      return NextResponse.json({ error: "Não foi possível verificar as permissões do usuário." }, { status: 500 });
    }
    if (!member) {
      return NextResponse.json({ error: "Acesso negado à barbearia." }, { status: 403 });
    }

    const roleParse = roleSchema.safeParse(member.role);
    if (!roleParse.success) {
      return NextResponse.json({ error: "O perfil do usuário não possui uma função autorizada." }, { status: 403 });
    }

    const userRole = roleParse.data;
    // Mantém a regra desta rota: recepcionistas podem administrar agendamentos da barbearia.
    const isManagerOrOwner = userRole === "owner" || userRole === "manager" || userRole === "receptionist";

    const { data: existingAppt, error: checkError } = await supabase
      .from("appointments")
      .select("id, barber_id, barbershop_id")
      .eq("id", id)
      .maybeSingle();

    if (checkError) {
      console.error("[DELETE_APPOINTMENT_LOOKUP_ERROR]", checkError);
      return NextResponse.json({ error: "Não foi possível consultar o agendamento." }, { status: 500 });
    }
    if (!existingAppt) {
      return NextResponse.json({ error: "Agendamento não encontrado." }, { status: 404 });
    }
    if (existingAppt.barbershop_id !== member.barbershop_id) {
      return NextResponse.json({ error: "Acesso negado a este agendamento." }, { status: 403 });
    }

    if (!isManagerOrOwner) {
      const { data: myStaff, error: staffError } = await supabase
        .from("staff")
        .select("id")
        .eq("profile_id", user.id)
        .eq("barbershop_id", member.barbershop_id)
        .maybeSingle();

      if (staffError) {
        console.error("[DELETE_STAFF_LOOKUP_ERROR]", staffError);
        return NextResponse.json({ error: "Não foi possível verificar o profissional associado ao usuário." }, { status: 500 });
      }
      if (!myStaff) {
        return NextResponse.json({ error: "Não há um cadastro profissional associado a este usuário." }, { status: 403 });
      }

      // appointments.barber_id referencia staff.id, e não auth.users.id.
      if (existingAppt.barber_id !== myStaff.id) {
        return NextResponse.json({ error: "Você só pode excluir os seus próprios agendamentos." }, { status: 403 });
      }
    }

    const { data: deletedData, error: deleteError } = await supabase
      .from("appointments")
      .delete()
      .eq("id", id)
      .eq("barbershop_id", member.barbershop_id)
      .select("id")
      .maybeSingle();

    if (deleteError) {
      console.error("[DELETE_DB_ERROR]", deleteError);
      return NextResponse.json({ error: `Falha ao excluir na base de dados: ${deleteError.message}` }, { status: 400 });
    }
    if (!deletedData) {
      return NextResponse.json({ error: "O agendamento não foi excluído ou não está acessível." }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Agendamento excluído com sucesso." }, { status: 200 });
  } catch (error: unknown) {
    console.error("[DELETE_FATAL_ERROR]", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
