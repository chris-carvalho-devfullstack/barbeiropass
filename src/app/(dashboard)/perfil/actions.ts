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

// --- AUXILIAR: BUSCA BARBEARIA DO USUÁRIO ---

async function getBarbershopId(userId: string) {
  const supabase = await createClient();
  const { data: member, error } = await supabase
    .from("barbershop_members")
    .select("barbershop_id")
    .eq("profile_id", userId)
    .single();

  if (error || !member) return null;
  return member.barbershop_id;
}

// --- SERVER ACTIONS ---

/**
 * Atualiza a localização da barbearia (Etapa 3 - 50%)
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

  // Atualiza o score para 50%
  await supabase
    .from("barbershops")
    .update({ onboarding_score: 50 })
    .eq("id", barbershopId);

  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * Atualiza os horários de funcionamento (Etapa 4 - 70%)
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

  // Atualiza score para 70%
  await supabase
    .from("barbershops")
    .update({ onboarding_score: 70 })
    .eq("id", barbershopId);

  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * Atualiza aparência, contatos e finaliza onboarding (Etapa 5 - 100%)
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
      onboarding_score: 100 
    })
    .eq("id", barbershopId);

  if (updateError) return { error: updateError.message };

  revalidatePath("/dashboard");
  return { success: true };
}