"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ============================================================================
// BLINDAGEM ZERO TRUST: SCHEMAS DE VALIDAÇÃO NO BACKEND
// ============================================================================

const locationSchema = z.object({
  zip_code: z.any().transform(val => String(val || "").replace(/\D/g, "")).refine(val => val.length === 8, "CEP deve conter exatamente 8 dígitos"),
  
  street: z.any().transform(val => String(val || "").trim()).refine(val => val.length >= 2, "Rua inválida"),
  
  number: z.any().transform(val => String(val || "").trim()).refine(val => val.length > 0, "Número obrigatório"),
  
  district: z.any().transform(val => String(val || "").trim()).refine(val => val.length >= 2, "Bairro inválido"),
  
  city: z.any().transform(val => String(val || "").trim()).refine(val => val.length >= 2, "Cidade inválida"),
  
  // Agora validamos com rigor: deve ser uma sigla de estado válida com exatamente 2 letras (ex: SP, RJ, MG)
  state: z.any().transform(val => String(val || "").toUpperCase().trim()).refine(val => val.length === 2, "Estado (UF) deve conter exatamente 2 letras"),
  
  complement: z.any().transform(val => val ? String(val).trim() : ""),
});

const businessHourSchema = z.array(
  z.object({
    day_of_week: z.number().min(0).max(6),
    open_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Hora inválida"),
    close_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Hora inválida"),
    is_closed: z.boolean(),
  })
);

const appearanceSchema = z.object({
  description: z.string().max(1000, "A descrição é muito longa").optional(),
  phone: z.string().optional(),
  instagram: z.string().optional(),
});

const settingsSchema = z.object({
  styles: z.array(z.string()),
  target_audience: z.array(z.string()),
  amenities: z.object({
    parking: z.boolean(),
    wifi: z.boolean(),
    airConditioning: z.boolean(),
    accessibility: z.boolean(),
    beer: z.boolean(),
    videogame: z.boolean(),
    coffee: z.boolean(),
    kidsArea: z.boolean(),
  }),
});

// --- INTERFACES DE TIPAGEM ---

export type LocationFormData = z.infer<typeof locationSchema>;
export type BusinessHourItem = z.infer<typeof businessHourSchema>[number];
export type AppearanceFormData = z.infer<typeof appearanceSchema>;
export type BarbershopSettingsData = z.infer<typeof settingsSchema>;

// ============================================================================
// AUXILIAR: BUSCA BARBEARIA DO USUÁRIO
// ============================================================================

async function getBarbershopId(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: member, error } = await supabase
    .from("barbershop_members")
    .select("barbershop_id")
    .eq("profile_id", userId)
    .single();

  if (error || !member) return null;
  return member.barbershop_id;
}

// ============================================================================
// FUNÇÃO MESTRE: RECÁLCULO DINÂMICO DO SCORE E STATUS
// ============================================================================

export async function refreshOnboardingScore(barbershopId: string): Promise<number> {
  const supabase = await createClient();
  let score = 30; // Pontuação base do cadastro inicial

  // 1. Verifica Endereço
  const { data: location } = await supabase
    .from("barbershop_locations")
    .select("id")
    .eq("barbershop_id", barbershopId)
    .single();
  
  if (location) score += 20;

  // 2. Verifica Horários
  const { count: hoursCount } = await supabase
    .from("barbershop_business_hours")
    .select("*", { count: "exact", head: true })
    .eq("barbershop_id", barbershopId);
  
  if (hoursCount && hoursCount > 0) score += 20;

  // 3. Verifica Serviços
  const { count: servicesCount } = await supabase
    .from("services")
    .select("*", { count: "exact", head: true })
    .eq("barbershop_id", barbershopId);
  
  if (servicesCount && servicesCount > 0) score += 20;

  // 4. Verifica Aparência/Perfil
  const { data: barbershop } = await supabase
    .from("barbershops")
    .select("description, logo_url")
    .eq("id", barbershopId)
    .single();
  
  if (barbershop?.description || barbershop?.logo_url) score += 10;

  // 5. Calcula o status com base no score
  const newStatus = score === 100 ? 'active' : 'incomplete';

  // 6. Atualiza o valor final E o status no banco (CORRIGIDO)
  const { error: updateError } = await supabase
    .from("barbershops")
    .update({ 
      onboarding_score: score,
      status: newStatus 
    })
    .eq("id", barbershopId);

  if (updateError) {
    console.error("[SECURITY LOG] Erro ao atualizar score/status:", updateError);
  }

  // 🏆 LÓGICA DE GAMIFICAÇÃO: Dar o selo PERFIL_OURO
  if (score === 100) {
    await supabase
      .from("barbershop_achievements")
      .upsert({
        barbershop_id: barbershopId,
        badge_type: "PERFIL_OURO"
      }, { onConflict: 'barbershop_id,badge_type', ignoreDuplicates: true });
  }

  return score;
}

// ============================================================================
// SERVER ACTIONS
// ============================================================================

/**
 * Atualiza a localização da barbearia
 */
export async function updateLocation(formData: LocationFormData) {
  // Validação Zero Trust
  const parsed = locationSchema.safeParse(formData);
  
  if (!parsed.success) {
    // 🔍 DIAGNÓSTICO: Isso vai imprimir no terminal do seu VSCode EXATAMENTE o que falhou
    console.error("[SECURITY LOG] Bloqueio Zod Endereço:", parsed.error.flatten().fieldErrors);
    return { error: "Dados de endereço inválidos enviados ao servidor." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: "Não autorizado" };

  const barbershopId = await getBarbershopId(user.id);
  if (!barbershopId) return { error: "Barbearia não encontrada" };

  // Tratamento do complemento nulo antes de enviar para o banco
  const safeComplement = parsed.data.complement || "";

  const { error: locError } = await supabase
    .from("barbershop_locations")
    .upsert({
      barbershop_id: barbershopId,
      zip_code: parsed.data.zip_code,
      street: parsed.data.street,
      number: parsed.data.number,
      district: parsed.data.district,
      city: parsed.data.city,
      state: parsed.data.state,
      complement: safeComplement,
    }, { onConflict: 'barbershop_id' });

  if (locError) return { error: "Erro interno ao atualizar localização." };

  await refreshOnboardingScore(barbershopId);

  revalidatePath("/dashboard");
  revalidatePath("/perfil/endereco");
  return { success: true };
}

/**
 * Atualiza os horários de funcionamento
 */
export async function updateBusinessHours(hours: BusinessHourItem[]) {
  // Validação Zero Trust
  const parsed = businessHourSchema.safeParse(hours);
  if (!parsed.success) return { error: "Formato de horários inválido enviado ao servidor." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: "Não autorizado" };

  const barbershopId = await getBarbershopId(user.id);
  if (!barbershopId) return { error: "Barbearia não encontrada" };

  const formattedHours = parsed.data.map(h => ({
    barbershop_id: barbershopId,
    day_of_week: h.day_of_week,
    open_time: h.open_time,
    close_time: h.close_time,
    is_closed: h.is_closed
  }));

  const { error: hourError } = await supabase
    .from("barbershop_business_hours")
    .upsert(formattedHours, { onConflict: 'barbershop_id,day_of_week' });

  if (hourError) return { error: "Erro interno ao registrar horários de funcionamento." };

  await refreshOnboardingScore(barbershopId);

  revalidatePath("/dashboard");
  revalidatePath("/perfil/horarios");
  return { success: true };
}

/**
 * Atualiza aparência e contatos
 */
export async function updateAppearance(formData: AppearanceFormData) {
  // Validação Zero Trust
  const parsed = appearanceSchema.safeParse(formData);
  if (!parsed.success) return { error: "Dados de aparência inválidos enviados ao servidor." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: "Não autorizado" };

  const barbershopId = await getBarbershopId(user.id);
  if (!barbershopId) return { error: "Barbearia não encontrada" };

  const { error: updateError } = await supabase
    .from("barbershops")
    .update({
      description: parsed.data.description,
      phone: parsed.data.phone,
      instagram: parsed.data.instagram,
    })
    .eq("id", barbershopId);

  if (updateError) return { error: "Erro interno ao atualizar perfil." };

  await refreshOnboardingScore(barbershopId);

  revalidatePath("/dashboard");
  revalidatePath("/perfil/aparencia");
  return { success: true };
}

/**
 * Atualiza as configurações detalhadas da barbearia (Marketplace Premium)
 */
export async function updateBarbershopSettings(settings: BarbershopSettingsData) {
  // Validação Zero Trust
  const parsed = settingsSchema.safeParse(settings);
  if (!parsed.success) return { error: "Configurações inválidas enviadas ao servidor." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado" };

  const barbershopId = await getBarbershopId(user.id);
  if (!barbershopId) return { error: "Barbearia não encontrada" };

  const { error } = await supabase
    .from("barbershop_settings")
    .upsert({
      barbershop_id: barbershopId,
      styles: parsed.data.styles,
      target_audience: parsed.data.target_audience,
      amenities: parsed.data.amenities,
    }, { onConflict: 'barbershop_id' });

  if (error) return { error: "Erro interno ao atualizar configurações do estabelecimento." };

  await refreshOnboardingScore(barbershopId);
  
  revalidatePath("/dashboard");
  revalidatePath("/perfil/aparencia");
  return { success: true };
}

/**
 * Gatilho para ser chamado pelos componentes Client-Side (ex: Criação de Serviços)
 * para forçar o recálculo do Score e atualizar a Dashboard.
 */
export async function syncMyOnboardingScore() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return;

  const barbershopId = await getBarbershopId(user.id);
  if (barbershopId) {
    await refreshOnboardingScore(barbershopId);
    revalidatePath("/dashboard");
  }
}