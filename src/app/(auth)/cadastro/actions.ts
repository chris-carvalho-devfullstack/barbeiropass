"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// 1. Criamos a tipagem exata dos dados que vêm do formulário
interface RegisterFormData {
  fullName: string;
  email: string;
  phone: string;
  document: string;
  password: string;
}

// 2. Trocamos o 'any' pela nossa interface
export async function registerBarbershopOwner(formData: RegisterFormData) {
  const supabase = await createClient();

  // Cria o usuário no Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: formData.email,
    password: formData.password,
  });

  if (authError || !authData.user) {
    return { error: authError?.message || "Erro ao criar conta de autenticação." };
  }

  const userId = authData.user.id;

  // Insere os dados do Proprietário na tabela de Perfis
  const { error: profileError } = await supabase.from("profiles").insert({
    id: userId,
    full_name: formData.fullName,
    phone: formData.phone,
  });

  if (profileError) {
  console.error("Erro detalhado do banco:", profileError);
  return { error: `Erro do banco: ${profileError.message}` };
}

  // Cria um Slug amigável (ex: "Barbearia do Zé" -> "barbearia-do-ze")
  const slug = formData.fullName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  // Cria a Barbearia (Tenant)
  const { data: barbershopData, error: barbershopError } = await supabase
    .from("barbershops")
    .insert({
      name: formData.fullName,
      slug: slug,
      document: formData.document,
    })
    .select("id")
    .single();

 if (barbershopError) {
  console.error("Erro detalhado da barbearia:", barbershopError);
  return { error: `Erro na Barbearia: ${barbershopError.message}` };
}

  // Vincula o Proprietário à Barbearia com a role 'owner' (RBAC)
  const { error: memberError } = await supabase.from("barbershop_members").insert({
    barbershop_id: barbershopData.id,
    profile_id: userId,
    role: "owner",
  });

 if (memberError) {
  console.error("Erro detalhado de vínculo:", memberError);
  return { error: `Erro no Vínculo: ${memberError.message}` };
}

  // Tudo certo! Atualiza o cache da rota e retorna sucesso
  revalidatePath("/");
  return { success: true };
}