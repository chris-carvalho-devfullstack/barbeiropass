"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isValidCPF, isValidCNPJ } from "@/utils/validations";

// ============================================================================
// BLINDAGEM ZERO TRUST: SCHEMAS DE VALIDAÇÃO NO BACKEND
// ============================================================================

const profileSchemaBackend = z.object({
  fullName: z.string().min(3, "Nome inválido."),
  email: z.string().email("E-mail inválido."),
  phone: z.string().min(14, "Telefone incompleto."),
  password: z.string().min(6, "Senha não atende aos requisitos mínimos."),
});

const barbershopSchemaBackend = z.object({
  name: z.string().min(3, "Nome da barbearia inválido."),
  document: z.string().refine((val) => {
    const clean = val.replace(/\D/g, "");
    if (clean.length === 11) return isValidCPF(clean);
    if (clean.length === 14) return isValidCNPJ(clean);
    return false;
  }, "Documento (CPF/CNPJ) inválido."),
});

// ============================================================================
// ETAPA 1: CADASTRO DE USUÁRIO
// ============================================================================

interface RegisterProfileData {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

export async function registerProfile(formData: RegisterProfileData) {
  // 1. Validação de dados (Proteção contra Payload Injection)
  const parsedData = profileSchemaBackend.safeParse(formData);
  if (!parsedData.success) {
    return { error: "Dados inválidos enviados ao servidor." };
  }

  const supabase = await createClient();

  // 2. Cria o usuário no Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: formData.email,
    password: formData.password,
    options: {
      data: {
        full_name: formData.fullName,
        phone: formData.phone,
        role: "owner"
      }
    }
  });

  if (authError || !authData.user) {
    // Retorna mensagem segura, evitando expor detalhes de infraestrutura
    return { error: authError?.message || "Erro interno ao processar a criação da conta." };
  }

  return { success: true };
}

// ============================================================================
// ETAPA 2: CADASTRO DA BARBEARIA
// ============================================================================

interface RegisterBarbershopData {
  name: string;
  document: string;
}

export async function registerBarbershop(formData: RegisterBarbershopData) {
  // 1. Validação de dados (Proteção contra Payload Injection)
  const parsedData = barbershopSchemaBackend.safeParse(formData);
  if (!parsedData.success) {
    return { error: "Dados da barbearia inválidos enviados ao servidor." };
  }

  const supabase = await createClient();

  // 2. Verificação Absoluta de Identidade
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Acesso negado. Sessão inválida ou não autenticada." };
  }

  // 3. ZERO TRUST: Bloqueio de Duplicidade
  // Verifica se o usuário já tem um negócio vinculado antes de prosseguir
  const { data: existingMember, error: checkError } = await supabase
    .from("barbershop_members")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (checkError) {
    return { error: "Erro ao verificar integridade da conta." };
  }

  if (existingMember) {
    return { error: "Ação bloqueada: Esta conta já possui uma barbearia registrada." };
  }

  // 4. Sanitização e Criação de Slug
  const slug = formData.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  // 5. Inserção do Negócio
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
    console.error("[SECURITY LOG] Erro na inserção de barbearia:", barbershopError);
    return { error: "Erro interno ao registrar os dados do negócio." };
  }

  // 6. Inserção da Permissão (Vínculo Dono <-> Barbearia)
  const { error: memberError } = await supabase.from("barbershop_members").insert({
    barbershop_id: barbershopData.id,
    profile_id: user.id,
    role: "owner",
  });

  if (memberError) {
    console.error("[SECURITY LOG] Erro de vinculação de dono:", memberError);
    return { error: "Erro interno ao estabelecer permissões de acesso." };
  }

  revalidatePath("/");
  return { success: true };
}