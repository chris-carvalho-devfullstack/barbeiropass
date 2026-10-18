// src/app/api/configuracoes/aparencia/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { refreshOnboardingScore } from "@/app/(dashboard)/perfil/actions";

export const runtime = "edge";

// Validação de telefone aceitando string vazia, null ou undefined
const phoneValidation = z
  .string()
  .nullable()
  .optional()
  .transform((val) => (val ? val.trim() : ""))
  .refine((val) => {
    if (!val) return true;
    const cleanPhone = val.replace(/\D/g, "");
    return cleanPhone.length === 0 || cleanPhone.length === 10 || cleanPhone.length === 11;
  }, "Número de telefone deve conter DDD + Número (10 ou 11 dígitos).");

const appearanceSchema = z.object({
  description: z
    .string()
    .max(1000, "A descrição é muito longa")
    .nullable()
    .optional()
    .transform((val) => val ?? ""),
  phone: phoneValidation,
  instagram: z
    .string()
    .nullable()
    .optional()
    .transform((val) => val ?? ""),
});

const settingsSchema = z.object({
  styles: z.array(z.string()).default([]),
  target_audience: z.array(z.string()).default([]),
  amenities: z
    .object({
      parking: z.boolean().default(false),
      wifi: z.boolean().default(false),
      airConditioning: z.boolean().default(false),
      accessibility: z.boolean().default(false),
      beer: z.boolean().default(false),
      videogame: z.boolean().default(false),
      coffee: z.boolean().default(false),
      kidsArea: z.boolean().default(false),
    })
    .default({
      parking: false,
      wifi: false,
      airConditioning: false,
      accessibility: false,
      beer: false,
      videogame: false,
      coffee: false,
      kidsArea: false,
    }),
  accepts_walk_in: z.boolean().default(true),
});

function sanitizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  const clean = phone.replace(/\D/g, "");
  return clean.length > 0 ? clean : null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { data: member, error: memberError } = await supabase
      .from("barbershop_members")
      .select("barbershop_id")
      .eq("profile_id", user.id)
      .single();

    if (memberError || !member?.barbershop_id) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });
    }

    const barbershopId = member.barbershop_id;

    // Suporta envio unificado { appearance, settings } ou direto no body
    const rawAppearance = body.appearance ?? body;
    const rawSettings = body.settings ?? (body.styles || body.amenities ? body : null);

    // 1. Valida e atualiza Aparência (tabela barbershops)
    const parsedAppearance = appearanceSchema.safeParse(rawAppearance);
    if (!parsedAppearance.success) {
      console.error(
        "[SECURITY LOG] Bloqueio Zod Aparência:",
        parsedAppearance.error.flatten().fieldErrors
      );
      const firstError =
        Object.values(parsedAppearance.error.flatten().fieldErrors)[0]?.[0] ||
        "Dados de aparência inválidos enviados ao servidor.";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const cleanPhone = sanitizePhone(parsedAppearance.data.phone);

    const { error: updateError } = await supabase
      .from("barbershops")
      .update({
        description: parsedAppearance.data.description,
        phone: cleanPhone,
        instagram: parsedAppearance.data.instagram,
      })
      .eq("id", barbershopId);

    if (updateError) {
      console.error("[SECURITY LOG] Erro Supabase barbershops update:", updateError);
      return NextResponse.json(
        { error: "Erro interno ao atualizar perfil da barbearia." },
        { status: 500 }
      );
    }

    // 2. Se houver configurações do Marketplace (barbershop_settings), valida e faz upsert
    if (rawSettings) {
      const parsedSettings = settingsSchema.safeParse(rawSettings);
      if (!parsedSettings.success) {
        console.error(
          "[SECURITY LOG] Bloqueio Zod Settings:",
          parsedSettings.error.flatten().fieldErrors
        );
        return NextResponse.json(
          { error: "Configurações inválidas enviadas ao servidor." },
          { status: 400 }
        );
      }

      const { error: settingsError } = await supabase
        .from("barbershop_settings")
        .upsert(
          {
            barbershop_id: barbershopId,
            styles: parsedSettings.data.styles,
            target_audience: parsedSettings.data.target_audience,
            amenities: parsedSettings.data.amenities,
            accepts_walk_in: parsedSettings.data.accepts_walk_in,
          },
          { onConflict: "barbershop_id" }
        );

      if (settingsError) {
        console.error("[SECURITY LOG] Erro Supabase barbershop_settings upsert:", settingsError);
        return NextResponse.json(
          { error: "Erro interno ao atualizar configurações do estabelecimento." },
          { status: 500 }
        );
      }
    }

    // 3. Recalcula o Onboarding Score e verifica conquista PERFIL_OURO
    await refreshOnboardingScore(barbershopId);

    try {
      revalidatePath("/dashboard");
      revalidatePath("/configuracoes/aparencia");
    } catch {
      // Ignora em contexto edge se não aplicável
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    console.error("[SECURITY LOG] Erro inesperado POST /api/configuracoes/aparencia:", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}