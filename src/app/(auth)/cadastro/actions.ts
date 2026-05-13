"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// --- ETAPA 1: Cadastro do Usuário ---
interface RegisterProfileData {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

export async function registerProfile(formData: RegisterProfileData) {
  const supabase = await createClient();

  // 1. Cria o usuário no Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: formData.email,
    password: formData.password,
  });

  if (authError || !authData.user) {
    return { error: authError?.message || "Erro ao criar conta de autenticação." };
  }

  const userId = authData.user.id;

  // 2. Insere os dados físicos na tabela 'profiles'
  const { error: profileError } = await supabase.from("profiles").insert({
    id: userId,
    full_name: formData.fullName,
    phone: formData.phone,
  });

  if (profileError) {
    console.error("Erro ao criar perfil:", profileError);
    return { error: `Erro ao salvar perfil: ${profileError.message}` };
  }

  return { success: true };
}

// --- ETAPA 2: Cadastro da Barbearia ---
interface RegisterBarbershopData {
  name: string;
  document: string;
}

export async function registerBarbershop(formData: RegisterBarbershopData) {
  const supabase = await createClient();

  // 1. Pega o usuário logado atual (que acabou de se cadastrar ou logou via Google)
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Usuário não autenticado. Faça login primeiro." };
  }

  // 2. Cria um Slug amigável
  const slug = formData.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  // 3. Cria a Barbearia
  const { data: barbershopData, error: barbershopError } = await supabase
    .from("barbershops")
    .insert({
      name: formData.name,
      slug: slug,
      document: formData.document,
    })
    .select("id")
    .single();

  if (barbershopError) {
    console.error("Erro ao criar barbearia:", barbershopError);
    return { error: `Erro na Barbearia: ${barbershopError.message}` };
  }

  // 4. Vincula o Usuário à Barbearia como 'owner'
  const { error: memberError } = await supabase.from("barbershop_members").insert({
    barbershop_id: barbershopData.id,
    profile_id: user.id,
    role: "owner",
  });

  if (memberError) {
    console.error("Erro ao vincular dono:", memberError);
    return { error: `Erro no Vínculo: ${memberError.message}` };
  }

  revalidatePath("/");
  return { success: true };
}