// src/app/api/perfil/horarios/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { z } from "zod";

export const runtime = 'edge';

const scheduleSchema = z.array(z.object({
  day_of_week: z.number().min(0).max(6),
  is_active: z.boolean(),
  start_time: z
    .string()
    .transform((val) => val.slice(0, 5))
    .refine((val) => /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(val), "Hora inválida"),
  end_time: z
    .string()
    .transform((val) => val.slice(0, 5))
    .refine((val) => /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(val), "Hora inválida"),
  service_mode: z.enum(['appointment', 'queue', 'hybrid']).default('appointment'),
}));

const queueAvailabilitySchema = z.object({
  accepting_queue: z.boolean(),
});

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    // Procurar também o barbershop_id
    const { data: staff, error: staffError } = await supabase
      .from("staff")
      .select("id, barbershop_id, accepting_queue")
      .eq("profile_id", user.id)
      .single();

    if (staffError || !staff) throw new Error("Perfil de profissional não encontrado.");

    // Procurar a configuração global da barbearia para o Walk-in
    const { data: settings } = await supabase
      .from("barbershop_settings")
      .select("accepts_walk_in")
      .eq("barbershop_id", staff.barbershop_id)
      .single();

    const acceptsWalkIn = settings?.accepts_walk_in ?? true; 

    const { data: horarios, error: horariosError } = await supabase
      .from("staff_working_hours")
      .select("day_of_week, start_time, end_time, is_active, service_mode")
      .eq("staff_id", staff.id)
      .order("day_of_week", { ascending: true });

    if (horariosError) throw horariosError;

    // Normaliza HH:MM:SS do Postgres para HH:MM antes de enviar ao frontend
    const normalizedHorarios = (horarios || []).map((h) => ({
      ...h,
      start_time: h.start_time ? String(h.start_time).slice(0, 5) : "09:00",
      end_time: h.end_time ? String(h.end_time).slice(0, 5) : "19:00",
    }));

    // Retorna os horários e também a permissão global
    return NextResponse.json({
      data: normalizedHorarios,
      acceptsWalkIn,
      acceptingQueue: staff.accepting_queue ?? true,
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const validation = queueAvailabilitySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Dados de disponibilidade inválidos." }, { status: 400 });
    }

    // A conta autenticada determina qual registro pode ser alterado.
    // O cliente administrativo evita depender de uma política RLS de UPDATE
    // sobre staff; a autorização é validada antes de usar o cliente admin.
    const admin = createAdminClient();
    const { data: staff, error: staffError } = await admin
      .from("staff")
      .select("id, role")
      .eq("profile_id", user.id)
      .single();

    if (staffError || !staff) {
      return NextResponse.json({ error: "Perfil de profissional não encontrado." }, { status: 404 });
    }

    if (staff.role !== "barber") {
      return NextResponse.json({ error: "Somente barbeiros podem alterar sua disponibilidade na fila." }, { status: 403 });
    }

    const { data: updatedStaff, error: updateError } = await admin
      .from("staff")
      .update({ accepting_queue: validation.data.accepting_queue })
      .eq("id", staff.id)
      .eq("profile_id", user.id)
      .eq("role", "barber")
      .select("accepting_queue")
      .single();

    if (updateError || !updatedStaff) {
      console.error("Erro ao atualizar disponibilidade na fila:", updateError);
      return NextResponse.json({ error: "Não foi possível atualizar a disponibilidade na fila." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      acceptingQueue: updatedStaff.accepting_queue ?? true,
      message: updatedStaff.accepting_queue
        ? "Disponibilidade para novos atendimentos ativada."
        : "Novos atendimentos pausados.",
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Erro ao alterar disponibilidade na fila:", error);
      return NextResponse.json({ error: "Erro interno ao atualizar a disponibilidade." }, { status: 500 });
    }
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await request.json();
    const validation = scheduleSchema.safeParse(body.schedule);
    
    if (!validation.success) {
      return NextResponse.json({ error: "Dados inválidos", details: validation.error.format() }, { status: 400 });
    }

    const { data: staff, error: staffError } = await supabase
      .from("staff")
      .select("id, barbershop_id")
      .eq("profile_id", user.id)
      .single();

    if (staffError || !staff) throw new Error("Acesso negado.");

    const upsertPayload = validation.data.map(dia => ({
      staff_id: staff.id,
      barbershop_id: staff.barbershop_id,
      day_of_week: dia.day_of_week,
      start_time: dia.start_time,
      end_time: dia.end_time,
      is_active: dia.is_active,
      service_mode: dia.service_mode,
    }));

    const { error: upsertError } = await supabase
      .from("staff_working_hours")
      .upsert(upsertPayload, { onConflict: 'staff_id,day_of_week' });

    if (upsertError) throw new Error("Erro ao guardar horários no banco de dados.");

    return NextResponse.json({ success: true, message: "Horários atualizados com sucesso." });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}