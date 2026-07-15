// src/app/api/perfil/horarios/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { z } from "zod";

export const runtime = 'edge';

const scheduleSchema = z.array(z.object({
  day_of_week: z.number().min(0).max(6),
  is_active: z.boolean(),
  start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Hora inválida"),
  end_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Hora inválida"),
  service_mode: z.enum(['appointment', 'queue', 'hybrid']).default('appointment'),
}));

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    // Modificado: Procurar também o barbershop_id
    const { data: staff, error: staffError } = await supabase
      .from("staff")
      .select("id, barbershop_id")
      .eq("profile_id", user.id)
      .single();

    if (staffError || !staff) throw new Error("Perfil de profissional não encontrado.");

    // NOVO: Procurar a configuração global da barbearia para o Walk-in
    const { data: settings } = await supabase
      .from("barbershop_settings")
      .select("accepts_walk_in")
      .eq("barbershop_id", staff.barbershop_id)
      .single();

    // Se for null, assumimos falso por segurança
    const acceptsWalkIn = settings?.accepts_walk_in ?? false; 

    const { data: horarios, error: horariosError } = await supabase
      .from("staff_working_hours")
      .select("day_of_week, start_time, end_time, is_active, service_mode")
      .eq("staff_id", staff.id)
      .order("day_of_week", { ascending: true });

    if (horariosError) throw horariosError;

    // Retorna os horários e também a permissão global
    return NextResponse.json({ data: horarios, acceptsWalkIn });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
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