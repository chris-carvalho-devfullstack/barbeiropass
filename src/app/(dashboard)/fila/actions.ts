// src/app/(dashboard)/fila/actions.ts
"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// 1. Entrar na Fila (Ação para o Cliente via Celular)
export async function joinQueueAction(data: { 
  barbershop_id: string; 
  client_name: string; 
  client_id?: string | null; 
}) {
  const supabase = await createClient();

  // Inserção na tabela virtual_queue
  const { error } = await supabase
    .from("virtual_queue")
    .insert({
      barbershop_id: data.barbershop_id,
      client_name: data.client_name,
      client_id: data.client_id || null,
      status: 'waiting'
    });

  if (error) {
    console.error("Erro ao entrar na fila:", error.message);
    return { error: "Erro ao entrar na fila." };
  }

  // Revalida as páginas para os dados aparecerem na hora
  revalidatePath("/fila");
  revalidatePath("/pdv");
  
  return { success: true };
}

// 2. Atualizar Status (Para uso interno da Barbearia)
export async function updateQueueStatusAction(id: string, status: string) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from("virtual_queue")
    .update({ status })
    .eq("id", id);

  if (error) return { error: "Erro ao atualizar status." };

  revalidatePath("/fila");
  revalidatePath("/pdv");
  return { success: true };
}