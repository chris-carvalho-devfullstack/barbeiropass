// src/app/api/agendamentos/[id]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { z } from "zod";

export const runtime = 'edge';

const roleSchema = z.enum(["owner", "manager", "barber", "receptionist"]);
const statusSchema = z.enum(["scheduled", "in_progress", "completed", "canceled", "awaiting_payment", "no_show"]);

const updateAppointmentSchema = z.object({
  status: statusSchema.optional(),
  start_time: z.string().datetime().optional(),
  end_time: z.string().datetime().optional(),
  service_id: z.string().uuid().optional(),
  client_id: z.string().uuid().optional(),
  notes: z.string().nullable().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: "Nenhum dado válido fornecido para atualização.",
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteParams) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const rawBody = await request.json().catch(() => null);
    const bodyValidation = updateAppointmentSchema.safeParse(rawBody);

    if (!bodyValidation.success) {
      return NextResponse.json(
        { error: "Dados inválidos fornecidos.", details: bodyValidation.error.format() },
        { status: 400 }
      );
    }

    const payloadAtualizacao = bodyValidation.data;

    // CORREÇÃO AQUI: Mudado de staff_role_type para role
    const { data: member, error: memberError } = await supabase
      .from("barbershop_members")
      .select("barbershop_id, role")
      .eq("profile_id", user.id)
      .single();

    if (memberError || !member) {
      console.error("[PATCH_ROLE_ERROR]", memberError);
      throw new Error("Acesso negado à barbearia.");
    }

    // CORREÇÃO AQUI: Avaliando member.role
    const roleParse = roleSchema.safeParse(member.role);
    const userRole = roleParse.success ? roleParse.data : "barber";
    const isManagerOrOwner = userRole === "owner" || userRole === "manager" || userRole === "receptionist";

    const { data: existingAppt, error: checkError } = await supabase
      .from("appointments")
      .select("barber_id, barbershop_id")
      .eq("id", id)
      .single();

    if (checkError || !existingAppt) {
      return NextResponse.json({ error: "Agendamento não encontrado." }, { status: 404 });
    }

    if (existingAppt.barbershop_id !== member.barbershop_id) {
      return NextResponse.json({ error: "Acesso negado a este registo." }, { status: 403 });
    }

    if (!isManagerOrOwner && existingAppt.barber_id !== user.id) {
      return NextResponse.json({ error: "Apenas pode alterar os seus próprios agendamentos." }, { status: 403 });
    }

    const { data: updatedData, error: updateError } = await supabase
      .from("appointments")
      .update(payloadAtualizacao)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("[PATCH_UPDATE_DB_ERROR]", updateError);
      throw new Error(`Falha ao atualizar na base de dados: ${updateError.message}`);
    }

    return NextResponse.json({ success: true, data: updatedData, message: "Agendamento atualizado com sucesso." }, { status: 200 });

  } catch (error: unknown) {
    console.error("[PATCH_FATAL_ERROR]", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteParams) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    // CORREÇÃO AQUI: Mudado de staff_role_type para role
    const { data: member, error: memberError } = await supabase
      .from("barbershop_members")
      .select("barbershop_id, role")
      .eq("profile_id", user.id)
      .single();

    if (memberError || !member) {
      console.error("[DELETE_ROLE_ERROR]", memberError);
      throw new Error("Acesso negado à barbearia.");
    }

    // CORREÇÃO AQUI: Avaliando member.role
    const roleParse = roleSchema.safeParse(member.role);
    const userRole = roleParse.success ? roleParse.data : "barber";
    const isManagerOrOwner = userRole === "owner" || userRole === "manager" || userRole === "receptionist";

    const { data: existingAppt, error: checkError } = await supabase
      .from("appointments")
      .select("barber_id, barbershop_id")
      .eq("id", id)
      .single();

    if (checkError || !existingAppt) {
      return NextResponse.json({ error: "Agendamento não encontrado." }, { status: 404 });
    }

    if (existingAppt.barbershop_id !== member.barbershop_id) {
      return NextResponse.json({ error: "Acesso negado a este registo." }, { status: 403 });
    }

    if (!isManagerOrOwner && existingAppt.barber_id !== user.id) {
      return NextResponse.json({ error: "Apenas pode excluir os seus próprios agendamentos." }, { status: 403 });
    }

    const { error: deleteError } = await supabase
      .from("appointments")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("[DELETE_DB_ERROR]", deleteError);
      throw new Error(`Falha ao excluir na base de dados: ${deleteError.message}`);
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