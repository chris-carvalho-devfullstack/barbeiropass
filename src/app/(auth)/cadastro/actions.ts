"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin"; // <-- ADICIONADO: O Cliente com Privilégios Elevados
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isValidCPF, isValidCNPJ } from "@/utils/validations";

// ============================================================================
// BLINDAGEM ZERO TRUST: SCHEMAS DE VALIDAÇÃO NO BACKEND
// ============================================================================

const profileSchemaBackend = z.object({
  fullName: z.string().min(3, "Nome inválido."),
  email: z.string().email("E-mail inválido."),
  // ZERO TRUST: Remove a formatação, garante que só tem números e valida o tamanho exato (Fixo ou Telemóvel)
  phone: z.string().refine((val) => {
    const cleanPhone = val.replace(/\D/g, ""); // Remove tudo que não é número
    return cleanPhone.length === 10 || cleanPhone.length === 11;
  }, "Número de telefone inválido."),
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
  // 1. Validação Zod (Garante que é um número válido)
  const parsedData = profileSchemaBackend.safeParse(formData);
  if (!parsedData.success) {
    return { error: "Dados inválidos enviados ao servidor." };
  }

  const supabase = await createClient();

  // 2. Normalização do Telefone (Padrão E.164 para WhatsApp/SMS futuro)
  // Exemplo: (11) 98888-7777 vira 5511988887777 (Considerando Brasil +55)
  const cleanPhone = formData.phone.replace(/\D/g, "");
  const normalizedPhone = `55${cleanPhone}`; 

  // 3. ZERO TRUST: Checagem de Duplicidade na Tabela Profiles
  // *Nota: Assumo que você tem uma tabela 'profiles' onde o telefone também fica guardado.
  // Se não tiver, essa checagem pode ser feita cruzando emails, mas ter o telefone único na 'profiles' é o ideal.
  const { data: existingPhone } = await supabase
    .from("profiles")
    .select("id")
    .eq("phone", normalizedPhone)
    .maybeSingle();

  if (existingPhone) {
    return { error: "Ação bloqueada: Este número de telefone já está a ser utilizado por outra conta." };
  }

  // 4. Cria o utilizador no Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: formData.email,
    password: formData.password,
    options: {
      data: {
        full_name: formData.fullName,
        phone: normalizedPhone, // Gravamos a versão limpa e segura!
        role: "owner"
      }
    }
  });

  if (authError || !authData.user) {
    return { error: authError?.message || "Erro interno ao processar a criação da conta." };
  }

  return { success: true };
}
// ============================================================================
// ETAPA 2: CADASTRO DA BARBEARIA E VÍNCULO SEGURO
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

  const supabase = await createClient(); // Cliente restrito (RLS Ativo)

  // 2. Verificação Absoluta de Identidade
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Acesso negado. Sessão inválida ou não autenticada." };
  }

  // 3. ZERO TRUST: Bloqueio de Duplicidade
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

  // NOVO: 3.5 ZERO TRUST - BLOQUEIO DE DOCUMENTO DUPLICADO
  // ====================================================================
  // Para evitar que a formatação burle o sistema (ex: "123.456" vs "123456"),
  // o ideal é sempre buscar no banco pelo formato exato que salvamos.
  const { data: documentExists, error: docError } = await supabase
    .from("barbershops")
    .select("id")
    .eq("document", formData.document) // Verifica se o CPF/CNPJ já existe
    .maybeSingle();

  if (docError) {
    console.error("[SECURITY LOG] Erro ao verificar duplicidade de documento:", docError);
    return { error: "Erro ao verificar a disponibilidade do documento." };
  }

  if (documentExists) {
    return { error: "Ação bloqueada: Este CPF/CNPJ já está vinculado a outra barbearia cadastrada." };
  }

  // 4. Sanitização e Criação de Slug
  const slug = formData.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  // 5. Inserção do Negócio
  // (Funciona pois a política "Permitir criacao de barbearia" está aberta para INSERT público)
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

  // ============================================================================
  // ETAPA 6: INSERÇÃO DE PERMISSÃO - ELEVAÇÃO DE PRIVILÉGIO (ZERO TRUST)
  // Como fechamos o RLS da tabela barbershop_members, o usuário não pode
  // vincular a si mesmo. Usamos o cliente Admin rodando isolado no servidor.
  // ============================================================================
  const supabaseAdmin = createAdminClient();

  const { error: memberError } = await supabaseAdmin.from("barbershop_members").insert({
    barbershop_id: barbershopData.id,
    profile_id: user.id,
    role: "owner",
  });

  if (memberError) {
    console.error("[SECURITY LOG] Erro de vinculação de dono pelo Admin:", memberError);
    
    // SISTEMA DE ROLLBACK (Se o vínculo falhar, apagamos a barbearia que ele acabou de criar)
    await supabaseAdmin.from("barbershops").delete().eq("id", barbershopData.id);
    
    return { error: "Erro interno ao estabelecer permissões de acesso. Tente novamente." };
  }

  revalidatePath("/");
  return { success: true };
}