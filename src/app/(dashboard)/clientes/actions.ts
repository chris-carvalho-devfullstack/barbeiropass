// src/app/(dashboard)/clientes/actions.ts
'use server';

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function getClientes() {
  const supabase = await createClient();
  const { data: clientes, error } = await supabase.from('clientes').select('*').order('created_at', { ascending: false });
  if (error) throw new Error("Não foi possível carregar a lista de clientes.");
  return clientes || [];
}

export async function getClienteById(id: string) {
  const supabase = await createClient();
  const { data: cliente, error } = await supabase.from('clientes').select('*').eq('id', id).single();
  if (error) throw new Error("Cliente não encontrado.");
  return cliente;
}

export async function getClienteTimeline(clienteId: string) {
  const supabase = await createClient();
  const { data: eventos, error } = await supabase.from('event_log').select('*').eq('entity_id', clienteId).order('created_at', { ascending: false });
  if (error) throw new Error("Não foi possível carregar o histórico.");
  return eventos || [];
}

// NOVA FUNÇÃO: Atualizar dados do cliente (CRM Real)
export async function updateCliente(id: string, data: { name: string; phone?: string; email?: string; cpf?: string; notes?: string }) {
  const supabase = await createClient();
  const { error } = await supabase.from('clientes').update(data).eq('id', id);
  if (error) throw new Error("Erro ao atualizar o cliente.");
  revalidatePath(`/clientes/${id}`);
  revalidatePath('/clientes');
  return { success: true };
}