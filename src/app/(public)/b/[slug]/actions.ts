"use server";

import { createClient } from "@/utils/supabase/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";

// 1. Zod Schema: Blindagem de entrada
const joinQueueSchema = z.object({
  barbershopId: z.string().uuid("ID da barbearia inválido."),
  turnstileToken: z.string().min(1, "Token de segurança ausente."),
});

export async function joinPublicQueueAction(payload: { barbershopId: string; turnstileToken: string }) {
  try {
    // Valida o formato dos dados
    const parsed = joinQueueSchema.safeParse(payload);
    if (!parsed.success) {
      return { error: "Dados inválidos ou manipulados." };
    }

    const { barbershopId, turnstileToken } = parsed.data;

    // 2. Validação Secreta do Cloudflare Turnstile
    const turnstileEndpoint = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
    const secretKey = process.env.TURNSTILE_SECRET_KEY;

    if (!secretKey) {
      console.error("[CRITICAL] TURNSTILE_SECRET_KEY não configurada no servidor.");
      return { error: "Erro de configuração no servidor." };
    }

    const turnstileRes = await fetch(turnstileEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${secretKey}&response=${turnstileToken}`,
    });
    
    const turnstileData = await turnstileRes.json();
    if (!turnstileData.success) {
      return { error: "Falha na verificação de segurança. O sistema suspeita de tráfego automatizado." };
    }

    // 3. Validação de Identidade no Supabase (Garante que é quem diz ser)
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { error: "Sessão inválida. Por favor, inicie sessão novamente." };
    }

    // 4. Verificação da Banlist (Lista Negra)
    const { data: isBanned } = await supabase
      .from("banned_users")
      .select("id")
      .eq("barbershop_id", barbershopId)
      .eq("user_email", user.email)
      .maybeSingle();

    if (isBanned) {
      return { error: "Acesso bloqueado. Não é possível entrar na fila desta barbearia." };
    }

    // 5. Prevenção de Duplicata (Já está na fila?)
    const { data: alreadyInQueue } = await supabase
      .from("virtual_queue")
      .select("id")
      .eq("barbershop_id", barbershopId)
      .eq("client_auth_id", user.id)
      .eq("status", "waiting")
      .maybeSingle();

    if (alreadyInQueue) {
      return { error: "Você já está a aguardar nesta fila!" };
    }

    // Extrair o nome do utilizador do Google (se não tiver, usa o início do e-mail)
    const clientName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Cliente";

    // 6. Inserção Segura na Base de Dados
    const { error: insertError } = await supabase
      .from("virtual_queue")
      .insert({
        barbershop_id: barbershopId,
        client_auth_id: user.id,
        client_auth_email: user.email,
        client_name: clientName,
        is_authenticated: true,
        turnstile_token_used: turnstileToken, // Fica guardado para auditoria
        status: "waiting",
      });

    if (insertError) {
      console.error("[DB ERROR] Erro ao entrar na fila:", insertError.message);
      return { error: "Ocorreu um erro ao registar a sua posição. Tente novamente." };
    }

    // Atualiza as páginas no servidor em tempo real para refletir a nova fila
    revalidatePath("/b/[slug]", "page");
    revalidatePath("/fila", "page"); 
    revalidatePath("/pdv", "page");

    return { success: true };

  } catch (err) {
    console.error("[ACTION ERROR] Falha catastrófica:", err);
    return { error: "Erro interno no servidor de fila." };
  }
}

// ... (mantenha o código da joinPublicQueueAction intacto lá em cima)

// NOVA AÇÃO: Validação Segura do PIN de Check-in
export async function verifyCheckinPinAction(barbershopId: string, providedPin: string) {
  try {
    const supabase = await createClient();
    
    // Busca o PIN real da barbearia de forma privada no servidor
    const { data: barbershop } = await supabase
      .from("barbershops")
      .select("checkin_pin")
      .eq("id", barbershopId)
      .single();

    if (!barbershop || !barbershop.checkin_pin) {
      return { success: false, error: "Barbearia não configurou o PIN." };
    }

    // Compara o PIN digitado com o PIN do banco
    if (barbershop.checkin_pin === providedPin.trim()) {
      return { success: true };
    }

    return { success: false, error: "Código incorreto. Verifique no balcão." };
  } catch (err) {
    console.error("[PIN ERROR]", err);
    return { success: false, error: "Erro ao validar o código." };
  }
}