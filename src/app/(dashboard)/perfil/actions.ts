"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// --- INTERFACES DE TIPAGEM ---

export interface LocationFormData {
  zip_code: string;
  street: string;
  number: string;
  district: string;
  city: string;
  state: string;
  complement?: string;
}

export interface BusinessHourItem {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

export interface AppearanceFormData {
  description?: string;
  phone?: string;
  instagram?: string;
}

export interface BarbershopSettingsData {
  styles: string[];
  target_audience: string[];
  amenities: {
    parking: boolean;
    wifi: boolean;
    airConditioning: boolean;
    accessibility: boolean;
    beer: boolean;
    videogame: boolean;
    coffee: boolean;
    kidsArea: boolean;
  };
}

// --- AUXILIAR: BUSCA BARBEARIA DO USUÁRIO ---

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

// --- FUNÇÃO MESTRE: RECÁLCULO DINÂMICO DO SCORE ---

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

  // Atualiza o valor final no banco
  await supabase
    .from("barbershops")
    .update({ onboarding_score: score })
    .eq("id", barbershopId);
    // 🏆 LÓGICA DE GAMIFICAÇÃO: Dar o selo PERFIL_OURO
  if (score === 100) {
    // Tenta inserir a conquista. O ON CONFLICT DO NOTHING evita erro se ele já tiver ganho antes.
    await supabase
      .from("barbershop_achievements")
      .upsert({
        barbershop_id: barbershopId,
        badge_type: "PERFIL_OURO"
      }, { onConflict: 'barbershop_id,badge_type', ignoreDuplicates: true });
  }


  return score;
}

// --- SERVER ACTIONS ---

/**
 * Atualiza a localização da barbearia
 */
export async function updateLocation(formData: LocationFormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: "Não autorizado" };

  const barbershopId = await getBarbershopId(user.id);
  if (!barbershopId) return { error: "Barbearia não encontrada" };

  // Upsert na localização
  const { error: locError } = await supabase
    .from("barbershop_locations")
    .upsert({
      barbershop_id: barbershopId,
      zip_code: formData.zip_code,
      street: formData.street,
      number: formData.number,
      district: formData.district,
      city: formData.city,
      state: formData.state,
      complement: formData.complement,
    }, { onConflict: 'barbershop_id' });

  if (locError) return { error: locError.message };

  // Atualiza o score dinamicamente com base no progresso real
  await refreshOnboardingScore(barbershopId);

  revalidatePath("/dashboard");
  revalidatePath("/perfil/endereco");
  return { success: true };
}

/**
 * Atualiza os horários de funcionamento
 */
export async function updateBusinessHours(hours: BusinessHourItem[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: "Não autorizado" };

  const barbershopId = await getBarbershopId(user.id);
  if (!barbershopId) return { error: "Barbearia não encontrada" };

  const formattedHours = hours.map(h => ({
    barbershop_id: barbershopId,
    day_of_week: h.day_of_week,
    open_time: h.open_time,
    close_time: h.close_time,
    is_closed: h.is_closed
  }));

  const { error: hourError } = await supabase
    .from("barbershop_business_hours")
    .upsert(formattedHours, { onConflict: 'barbershop_id,day_of_week' });

  if (hourError) {
    console.error("Erro ao salvar horários:", hourError);
    return { error: `Erro no banco: ${hourError.message}` };
  }

  // Atualiza o score dinamicamente com base no progresso real
  await refreshOnboardingScore(barbershopId);

  revalidatePath("/dashboard");
  revalidatePath("/perfil/horarios");
  return { success: true };
}

/**
 * Atualiza aparência e contatos
 */
export async function updateAppearance(formData: AppearanceFormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: "Não autorizado" };

  const barbershopId = await getBarbershopId(user.id);
  if (!barbershopId) return { error: "Barbearia não encontrada" };

  const { error: updateError } = await supabase
    .from("barbershops")
    .update({
      description: formData.description,
      phone: formData.phone,
      instagram: formData.instagram,
    })
    .eq("id", barbershopId);

  if (updateError) return { error: updateError.message };

  // Atualiza o score dinamicamente com base no progresso real
  await refreshOnboardingScore(barbershopId);

  revalidatePath("/dashboard");
  revalidatePath("/perfil/aparencia");
  return { success: true };
}

/**
 * Atualiza as configurações detalhadas da barbearia (Marketplace Premium)
 */
export async function updateBarbershopSettings(settings: BarbershopSettingsData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado" };

  const barbershopId = await getBarbershopId(user.id);
  if (!barbershopId) return { error: "Barbearia não encontrada" };

  const { error } = await supabase
    .from("barbershop_settings")
    .upsert({
      barbershop_id: barbershopId,
      styles: settings.styles,
      target_audience: settings.target_audience,
      amenities: settings.amenities,
    }, { onConflict: 'barbershop_id' });

  if (error) return { error: error.message };

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