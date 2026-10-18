// src/app/api/configuracoes/endereco/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { refreshOnboardingScore } from "@/app/(dashboard)/perfil/actions";

export const runtime = "edge";

const locationSchema = z.object({
  zip_code: z
    .any()
    .transform((val) => String(val || "").replace(/\D/g, ""))
    .refine((val) => val.length === 8, "CEP deve conter exatamente 8 dígitos"),
  street: z
    .any()
    .transform((val) => String(val || "").trim())
    .refine((val) => val.length >= 2, "Rua inválida"),
  number: z
    .any()
    .transform((val) => String(val || "").trim())
    .refine((val) => val.length > 0, "Número obrigatório"),
  district: z
    .any()
    .transform((val) => String(val || "").trim())
    .refine((val) => val.length >= 2, "Bairro inválido"),
  city: z
    .any()
    .transform((val) => String(val || "").trim())
    .refine((val) => val.length >= 2, "Cidade inválida"),
  state: z
    .any()
    .transform((val) => String(val || "").toUpperCase().trim())
    .refine((val) => val.length === 2, "Estado (UF) deve conter exatamente 2 letras"),
  complement: z.any().transform((val) => (val ? String(val).trim() : "")),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = locationSchema.safeParse(body);

    if (!parsed.success) {
      console.error("[SECURITY LOG] Bloqueio Zod Endereço:", parsed.error.flatten().fieldErrors);
      return NextResponse.json(
        { error: "Dados de endereço inválidos enviados ao servidor." },
        { status: 400 }
      );
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
    const safeComplement = parsed.data.complement || "";

    const { error: locError } = await supabase
      .from("barbershop_locations")
      .upsert(
        {
          barbershop_id: barbershopId,
          zip_code: parsed.data.zip_code,
          street: parsed.data.street,
          number: parsed.data.number,
          district: parsed.data.district,
          city: parsed.data.city,
          state: parsed.data.state,
          complement: safeComplement,
        },
        { onConflict: "barbershop_id" }
      );

    if (locError) {
      console.error("[SECURITY LOG] Erro ao salvar localização:", locError);
      return NextResponse.json(
        { error: "Erro interno ao atualizar localização." },
        { status: 500 }
      );
    }

    // Recalcula o score de Onboarding e verifica conquista PERFIL_OURO
    await refreshOnboardingScore(barbershopId);

    try {
      revalidatePath("/dashboard");
      revalidatePath("/configuracoes/endereco");
    } catch {
      // Ignora erro caso revalidatePath não seja suportado no contexto edge específico
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}