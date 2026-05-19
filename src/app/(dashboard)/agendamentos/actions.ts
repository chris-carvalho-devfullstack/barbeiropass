// src/app/(dashboard)/agendamentos/actions.ts
"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// 1. Buscar Agendamentos (Zero Trust: Baseado no usuário logado)
export async function getAppointmentsAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado" };

  const { data: member } = await supabase
    .from("barbershop_members")
    .select("barbershop_id")
    .eq("profile_id", user.id)
    .single();

  if (!member) return { error: "Barbearia não encontrada" };

  // Busca na tabela correta "appointments" e faz o JOIN com "services"
  const { data, error } = await supabase
    .from("appointments")
    .select(`
      id, 
      scheduled_at, 
      status, 
      client_name, 
      client_phone,
      services ( name, price, duration_minutes )
    `)
    .eq("barbershop_id", member.barbershop_id)
    .order("scheduled_at", { ascending: true });

  if (error) {
    console.error("[DB ERROR]", error);
    return { error: "Erro ao buscar agendamentos." };
  }

  return { data };
}

// 2. Atualizar Status (Protegido)
export async function updateAppointmentStatusAction(id: string, newStatus: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado" };

  const { error } = await supabase
    .from("appointments")
    .update({ status: newStatus })
    .eq("id", id);

  if (error) return { error: "Erro ao atualizar o status." };

  revalidatePath("/agendamentos"); // Atualiza a página
  revalidatePath("/pdv"); // Se ele concluiu aqui, pode refletir no PDV depois
  return { success: true };
}