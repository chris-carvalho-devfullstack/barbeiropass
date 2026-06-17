"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ============================================================================
// BLINDAGEM ZERO TRUST: SCHEMAS DE VALIDAÇÃO NO BACKEND
// ============================================================================

// Validação customizada para telefones (Remove a máscara e checa o tamanho)
const phoneValidation = z.string().optional().refine((val) => {
  if (!val) return true; // Permite vazio
  const cleanPhone = val.replace(/\D/g, "");
  return cleanPhone.length === 0 || cleanPhone.length === 10 || cleanPhone.length === 11;
}, "Número de telefone deve conter DDD + Número (10 ou 11 dígitos).");

const locationSchema = z.object({
  zip_code: z.any().transform(val => String(val || "").replace(/\D/g, "")).refine(val => val.length === 8, "CEP deve conter exatamente 8 dígitos"),
  street: z.any().transform(val => String(val || "").trim()).refine(val => val.length >= 2, "Rua inválida"),
  number: z.any().transform(val => String(val || "").trim()).refine(val => val.length > 0, "Número obrigatório"),
  district: z.any().transform(val => String(val || "").trim()).refine(val => val.length >= 2, "Bairro inválido"),
  city: z.any().transform(val => String(val || "").trim()).refine(val => val.length >= 2, "Cidade inválida"),
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
  phone: phoneValidation, // <-- APLICANDO A VALIDAÇÃO BLINDADA
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

const profileUpdateSchema = z.object({
  nome: z.string().min(2, "O nome deve ter pelo menos 2 caracteres"),
  telefone: phoneValidation, // <-- APLICANDO A VALIDAÇÃO BLINDADA
  cargo: z.enum(["owner", "manager", "receptionist"]),
  isBarber: z.boolean(),
});

// --- INTERFACES DE TIPAGEM ---

export type LocationFormData = z.infer<typeof locationSchema>;
export type BusinessHourItem = z.infer<typeof businessHourSchema>[number];
export type AppearanceFormData = z.infer<typeof appearanceSchema>;
export type BarbershopSettingsData = z.infer<typeof settingsSchema>;
export type ProfileUpdateData = z.infer<typeof profileUpdateSchema>;

// ============================================================================
// AUXILIAR: BUSCA BARBEARIA DO USUÁRIO E LIMPEZA DE DADOS
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

// Limpa qualquer formatação do telefone para salvar apenas números no banco
function sanitizePhone(phone?: string): string | null {
  if (!phone) return null;
  const clean = phone.replace(/\D/g, "");
  return clean.length > 0 ? clean : null;
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

  // 6. Atualiza o valor final E o status no banco
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
 * Atualiza o Perfil do Utilizador, Cargo Administrativo e Status de Barbeiro
 */
export async function updateUserProfileSettings(data: ProfileUpdateData) {
  const parsed = profileUpdateSchema.safeParse(data);
  if (!parsed.success) return { error: "Dados inválidos." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado" };

  const barbershopId = await getBarbershopId(user.id);
  if (!barbershopId) return { error: "Barbearia não encontrada" };

  // Limpa os parênteses e traços
  const cleanPhone = sanitizePhone(parsed.data.telefone);

  // ZERO TRUST: Verifica duplicidade do telefone ignorando a própria conta
  if (cleanPhone) {
    const { data: existingPhone } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone", cleanPhone)
      .neq("id", user.id) // Fundamental para permitir que o próprio usuário edite seus dados sem conflito
      .maybeSingle();

    if (existingPhone) {
      return { error: "Este número de telefone já está a ser utilizado noutra conta." };
    }
  }

  // 1. CHECAGEM DE SEGURANÇA: Prevenir a perda do último proprietário
  const { data: currentMember } = await supabase
    .from("barbershop_members")
    .select("role")
    .eq("barbershop_id", barbershopId)
    .eq("profile_id", user.id)
    .single();

  if (currentMember?.role === "owner" && parsed.data.cargo !== "owner") {
    const { count: ownerCount } = await supabase
      .from("barbershop_members")
      .select("*", { count: "exact", head: true })
      .eq("barbershop_id", barbershopId)
      .eq("role", "owner");

    if (ownerCount && ownerCount <= 1) {
      return { error: "A barbearia precisa ter pelo menos um proprietário ativo. Transfira a posse antes de alterar o seu cargo." };
    }
  }

  // 2. Atualizar Tabela de Membros (Nível de Acesso)
  const { error: memberError } = await supabase
    .from("barbershop_members")
    .update({ role: parsed.data.cargo })
    .eq("barbershop_id", barbershopId)
    .eq("profile_id", user.id);

  if (memberError) return { error: "Erro ao atualizar permissões de acesso." };

  // 3. Atualizar Tabela Staff (Operacional / Atendimento)
  if (parsed.data.isBarber) {
    const { data: existingStaff } = await supabase
      .from("staff")
      .select("id")
      .eq("barbershop_id", barbershopId)
      .eq("profile_id", user.id)
      .maybeSingle();

    const avatarUrl = user.user_metadata?.avatar_url || null;

    if (existingStaff) {
      const { error: updateError } = await supabase
        .from("staff")
        .update({
          role: "barber",
          full_name: parsed.data.nome,
          avatar_url: avatarUrl,
          is_active: true,
        })
        .eq("id", existingStaff.id);
        
      if (updateError) console.error("[SECURITY LOG] Erro ao atualizar staff:", updateError);
    } else {
      const { error: insertError } = await supabase
        .from("staff")
        .insert({
          barbershop_id: barbershopId,
          profile_id: user.id,
          role: "barber",
          full_name: parsed.data.nome,
          avatar_url: avatarUrl,
          is_active: true,
        });
        
      if (insertError) console.error("[SECURITY LOG] Erro ao inserir staff:", insertError);
    }
  } else {
    await supabase
      .from("staff")
      .update({ is_active: false })
      .eq("barbershop_id", barbershopId)
      .eq("profile_id", user.id);
  }

  // 4. Atualizar Dados Pessoais na tabela Profiles (Salvando o telefone limpo)
  await supabase
    .from("profiles")
    .update({ full_name: parsed.data.nome, phone: cleanPhone })
    .eq("id", user.id);

  revalidatePath("/perfil");
  revalidatePath("/equipe/staff"); 
  return { success: true };
}

/**
 * Atualiza a localização da barbearia
 */
export async function updateLocation(formData: LocationFormData) {
  const parsed = locationSchema.safeParse(formData);
  
  if (!parsed.success) {
    console.error("[SECURITY LOG] Bloqueio Zod Endereço:", parsed.error.flatten().fieldErrors);
    return { error: "Dados de endereço inválidos enviados ao servidor." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: "Não autorizado" };

  const barbershopId = await getBarbershopId(user.id);
  if (!barbershopId) return { error: "Barbearia não encontrada" };

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
  const parsed = appearanceSchema.safeParse(formData);
  if (!parsed.success) return { error: "Dados de aparência inválidos enviados ao servidor." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: "Não autorizado" };

  const barbershopId = await getBarbershopId(user.id);
  if (!barbershopId) return { error: "Barbearia não encontrada" };

  // Sanitização do telefone antes de gravar na barbearia
  const cleanPhone = sanitizePhone(parsed.data.phone);

  const { error: updateError } = await supabase
    .from("barbershops")
    .update({
      description: parsed.data.description,
      phone: cleanPhone,
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