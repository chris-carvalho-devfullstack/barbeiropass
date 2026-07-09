// src/app/api/agendamentos/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { z } from "zod";

export const runtime = 'edge';

// 1. Tipagens Estritas Baseadas nos Enums do Banco de Dados
const roleSchema = z.enum(["owner", "manager", "barber", "receptionist"]);

// 2. Validação para o corpo do POST (Evita injeção e garante os dados corretos)
const createAppointmentSchema = z.object({
  client_name: z.string().min(2, "O nome do cliente é obrigatório."),
  client_phone: z.string().nullable().optional(),
  // O zod valida se é uma string que pode ser convertida para Data
  scheduled_at: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Data e hora inválidas." }),
  barber_id: z.string().uuid("ID do barbeiro inválido.").optional(),
  // Duração estimada do atendimento. Se o front não enviar, assumimos 30 minutos por padrão.
  duration_minutes: z.number().int().positive().optional().default(30),
  // Aceita o array de serviços que o novo modal envia
  service_ids: z.array(z.string()).optional().default([]),
});

// ============================================================================
// METODO GET: Listar Agendamentos (Zero-Trust + Filtros)
// ============================================================================
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    // Autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("[ERRO_AUTH_GET]", authError);
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    // Coleta de Parâmetros
    const { searchParams } = new URL(request.url);
    const dataInicio = searchParams.get("start");
    const dataFim = searchParams.get("end");
    const specificBarberId = searchParams.get("barber_id");

    // Zero-Trust: Descobrir o cargo
    const { data: member, error: memberError } = await supabase
      .from("barbershop_members")
      .select("barbershop_id, role")
      .eq("profile_id", user.id)
      .single();

    if (memberError || !member) {
      console.error("[ERRO_SUPABASE_MEMBER_GET]", memberError);
      throw new Error("Acesso negado ou barbearia não encontrada.");
    }

    // Validação estrita do Cargo
    const roleParse = roleSchema.safeParse(member.role);
    const role = roleParse.success ? roleParse.data : "barber";
    const isManagerOrOwner = role === "owner" || role === "manager";

    // Buscar o ID de STAFF do usuário logado para filtrar a sua agenda corretamente
    const { data: myStaff } = await supabase
      .from("staff")
      .select("id")
      .eq("profile_id", user.id)
      .eq("barbershop_id", member.barbershop_id)
      .single();

    // Query Base CORRIGIDA: Buscar o full_name através do join com profiles
    let query = supabase
      .from("appointments")
      .select(`
        id, 
        scheduled_at, 
        status, 
        client_name, 
        client_phone,
        services ( name, price, duration_minutes ),
        staff!barber_id (
          full_name,
          profiles ( full_name ) 
        ) 
      `)
      .eq("barbershop_id", member.barbershop_id);

    // Filtros de Permissão
    if (!isManagerOrOwner) {
      // O barbeiro só pode ver sua própria agenda (usando o ID da tabela staff)
      if (myStaff) {
        query = query.eq("barber_id", myStaff.id);
      } else {
        // Se não for gerente e não tiver registro na tabela staff, não tem agenda a exibir
        return NextResponse.json({ data: [] });
      }
    } else if (specificBarberId) {
      // Gerente/Dono pode filtrar por um barbeiro específico
      query = query.eq("barber_id", specificBarberId);
    }

    // Filtros de Data
    if (dataInicio && dataFim) {
      query = query.gte("scheduled_at", dataInicio).lte("scheduled_at", dataFim);
    }

    // Ordenação (atendendo à exigência de listar do mais recente para o mais antigo considerando hora)
    query = query.order("scheduled_at", { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error("[ERRO_SUPABASE_APPOINTMENTS_GET]", error);
      throw new Error(`Erro ao buscar dados: ${error.message}`);
    }

    return NextResponse.json({ data });

  } catch (error: unknown) { 
    console.error("[ERRO_API_AGENDAMENTOS_GET]", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}

// ============================================================================
// METODO POST: Criar Agendamento com Time Blocking Inteligente
// ============================================================================
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // Autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("[ERRO_AUTH_POST]", authError);
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    // Processamento estrito do Body
    const rawBody = await request.json().catch(() => null);
    const validation = createAppointmentSchema.safeParse(rawBody);

    if (!validation.success) {
      console.error("[ERRO_ZOD_POST]", validation.error.format());
      return NextResponse.json(
        { error: "Dados de agendamento inválidos.", details: validation.error.format() }, 
        { status: 400 }
      );
    }

    const { client_name, client_phone, scheduled_at, barber_id, duration_minutes, service_ids } = validation.data;

    // Zero-Trust: Descobrir cargo do usuário
    const { data: member, error: memberError } = await supabase
      .from("barbershop_members")
      .select("barbershop_id, role")
      .eq("profile_id", user.id)
      .single();

    if (memberError || !member) {
      console.error("[ERRO_SUPABASE_MEMBER_POST]", memberError);
      throw new Error("Acesso negado à barbearia.");
    }

    const roleParse = roleSchema.safeParse(member.role);
    const role = roleParse.success ? roleParse.data : "barber";
    const isManagerOrOwner = role === "owner" || role === "manager";

    // Buscar o ID de STAFF do usuário logado
    const { data: myStaff } = await supabase
      .from("staff")
      .select("id")
      .eq("profile_id", user.id)
      .eq("barbershop_id", member.barbershop_id)
      .single();

    // Define de quem será o agendamento
    const finalBarberId = (isManagerOrOwner && barber_id) ? barber_id : myStaff?.id;

    if (!finalBarberId) {
      return NextResponse.json(
        { error: "Não foi possível encontrar o registro na equipe (staff) para associar o agendamento." }, 
        { status: 400 }
      );
    }

    // --- LÓGICA DE TIME BLOCKING (ANTI-CHOQUE DE HORÁRIOS) ---
    const requestedStart = new Date(scheduled_at);
    const requestedEnd = new Date(requestedStart.getTime() + duration_minutes * 60000);

    const dayStart = new Date(requestedStart);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(requestedStart);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const { data: todayAppointments, error: appointmentsError } = await supabase
      .from("appointments")
      .select("scheduled_at, status")
      .eq("barbershop_id", member.barbershop_id)
      .eq("barber_id", finalBarberId)
      .in("status", ["scheduled", "in_progress", "awaiting_payment"]) 
      .gte("scheduled_at", dayStart.toISOString())
      .lte("scheduled_at", dayEnd.toISOString());

    if (appointmentsError) {
      console.error("[ERRO_SUPABASE_AVAILABILITY_POST]", appointmentsError);
      throw new Error("Falha ao validar disponibilidade da agenda.");
    }

    // Checar sobreposição
    if (todayAppointments && todayAppointments.length > 0) {
      const isTimeBlocked = todayAppointments.some((appt) => {
        const apptStart = new Date(appt.scheduled_at);
        const apptEnd = new Date(apptStart.getTime() + 30 * 60000); 
        return (requestedStart < apptEnd && requestedEnd > apptStart);
      });

      if (isTimeBlocked) {
        return NextResponse.json(
          { error: "Já existe um agendamento neste horário para este barbeiro." }, 
          { status: 409 }
        );
      }
    }

    // Gravação segura no banco
    const { data: newAppointment, error: insertError } = await supabase
      .from("appointments")
      .insert({
        barbershop_id: member.barbershop_id,
        barber_id: finalBarberId,
        client_name,
        client_phone: client_phone || null,
        scheduled_at: requestedStart.toISOString(),
        status: "scheduled",
        service_id: service_ids.length > 0 ? service_ids[0] : null
      })
      .select()
      .single();

    if (insertError) {
      console.error("[ERRO_SUPABASE_INSERT_POST]", insertError);
      throw new Error("Erro do banco de dados ao salvar o agendamento.");
    }

    return NextResponse.json({ success: true, data: newAppointment }, { status: 201 });

  } catch (error: unknown) { 
    console.error("[ERRO_API_AGENDAMENTOS_POST]", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}