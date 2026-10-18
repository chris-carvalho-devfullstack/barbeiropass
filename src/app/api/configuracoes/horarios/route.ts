// src/app/api/configuracoes/horarios/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { refreshOnboardingScore } from "@/app/(dashboard)/perfil/actions";

export const runtime = 'edge';

const businessHourSchema = z.array(
  z.object({
    day_of_week: z.number().min(0).max(6),
    open_time: z
      .string()
      .transform((val) => val.slice(0, 5))
      .refine((val) => /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(val), "Hora inválida"),
    close_time: z
      .string()
      .transform((val) => val.slice(0, 5))
      .refine((val) => /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(val), "Hora inválida"),
    is_closed: z.boolean(),
  })
);

async function getBarbershopId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string | null> {
  const { data: member, error } = await supabase
    .from("barbershop_members")
    .select("barbershop_id")
    .eq("profile_id", userId)
    .single();

  if (error || !member) return null;
  return member.barbershop_id;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const barbershopId = await getBarbershopId(supabase, user.id);
    if (!barbershopId) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });
    }

    const { data: hours, error } = await supabase
      .from("barbershop_business_hours")
      .select("day_of_week, open_time, close_time, is_closed")
      .eq("barbershop_id", barbershopId)
      .order("day_of_week", { ascending: true });

    if (error) {
      console.error("[SECURITY LOG] Erro ao buscar horários da barbearia:", error);
      return NextResponse.json({ error: "Erro ao carregar horários." }, { status: 500 });
    }

    const formattedHours = (hours || []).map((h) => ({
      day_of_week: h.day_of_week,
      open_time: h.open_time ? String(h.open_time).slice(0, 5) : "09:00",
      close_time: h.close_time ? String(h.close_time).slice(0, 5) : "19:00",
      is_closed: Boolean(h.is_closed),
    }));

    return NextResponse.json({ hours: formattedHours }, { status: 200 });
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
    if (authError || !user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const rawHours = Array.isArray(body) ? body : body?.hours;

    const parsed = businessHourSchema.safeParse(rawHours);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Formato de horários inválido enviado ao servidor." },
        { status: 400 }
      );
    }

    const barbershopId = await getBarbershopId(supabase, user.id);
    if (!barbershopId) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });
    }

    const formattedHours = parsed.data.map((h) => ({
      barbershop_id: barbershopId,
      day_of_week: h.day_of_week,
      open_time: h.open_time,
      close_time: h.close_time,
      is_closed: h.is_closed,
    }));

    const { error: hourError } = await supabase
      .from("barbershop_business_hours")
      .upsert(formattedHours, { onConflict: "barbershop_id,day_of_week" });

    if (hourError) {
      console.error("[SECURITY LOG] Erro ao salvar horários da barbearia:", hourError);
      return NextResponse.json(
        { error: "Erro interno ao registrar horários de funcionamento." },
        { status: 500 }
      );
    }

    // Recalcula o Onboarding Score e verifica conquista PERFIL_OURO
    await refreshOnboardingScore(barbershopId);

    try {
      revalidatePath("/dashboard");
      revalidatePath("/configuracoes/horarios");
    } catch {
      // Ignora erro caso revalidatePath não seja suportado em contexto específico de edge
    }

    return NextResponse.json({ success: true, message: "Horários atualizados com sucesso!" });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}