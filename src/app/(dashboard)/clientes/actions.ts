// src/app/(dashboard)/clientes/actions.ts
"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function createClientAction(data: { name: string; phone: string }) {
  const supabase = await createClient();
  
  // 1. Valida quem está logado
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado" };

  // 2. Descobre a barbearia correta (Zero Trust)
  const { data: member } = await supabase
    .from("barbershop_members")
    .select("barbershop_id")
    .eq("profile_id", user.id)
    .single();

  if (!member) return { error: "Vínculo com barbearia não encontrado" };

  // 3. Insere o cliente na tabela correta com o vínculo obrigatório
  const { error: insertError } = await supabase
    .from("clientes")
    .insert({
      barbershop_id: member.barbershop_id,
      name: data.name,
      phone: data.phone,
    });

  if (insertError) {
    console.error("[DB ERROR]", insertError);
    return { error: "Erro ao cadastrar o cliente no banco de dados." };
  }

  // 4. Atualiza as telas que dependem dessa informação
  revalidatePath("/clientes");
  revalidatePath("/pdv");
  
  return { success: true };
}