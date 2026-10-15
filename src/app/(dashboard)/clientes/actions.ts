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

export async function createClientAction(input: {
  name: string;
  phone: string;
}) {
  const name = input.name.trim();
  const phone = input.phone.trim();
  const phoneDigits = phone.replace(/\D/g, "");

  // Validação dos dados recebidos pelo servidor.
  if (name.length < 3) {
    return {
      error: "O nome deve ter pelo menos 3 caracteres.",
    };
  }

  if (phoneDigits.length < 10) {
    return {
      error: "Informe um telefone válido com DDD.",
    };
  }

  const supabase = await createClient();

  // Confirma a sessão no servidor.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      error: "Sessão inválida. Faça login novamente.",
    };
  }

  // Obtém a barbearia vinculada ao usuário autenticado.
  const { data: member, error: memberError } = await supabase
    .from("barbershop_members")
    .select("barbershop_id")
    .eq("profile_id", user.id)
    .single();

  if (memberError || !member) {
    return {
      error: "Não foi possível identificar sua barbearia.",
    };
  }

  // Cria o cliente dentro da barbearia correspondente.
  const { error: insertError } = await supabase
    .from("clientes")
    .insert({
      barbershop_id: member.barbershop_id,
      name,
      phone: phoneDigits,
    });

  if (insertError) {
    console.error(
      "[createClientAction] Falha ao criar cliente:",
      insertError.message
    );

    return {
      error: "Não foi possível cadastrar o cliente.",
    };
  }

  revalidatePath("/clientes");

  return {
    success: true,
    error: null,
  };
}