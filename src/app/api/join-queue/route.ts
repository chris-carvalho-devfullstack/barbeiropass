// src/app/api/join-queue/route.ts
export const runtime = 'edge'; 

import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

// 1. ZOD SCHEMA RIGOROSO: Nenhuma requisição passa sem estes dados perfeitos
const joinQueueSchema = z.object({
  barbershopId: z.string().uuid("ID da barbearia inválido."),
  turnstileToken: z.string().min(10, "Token de segurança inválido."),
  barberId: z.string().uuid("ID do profissional inválido.").nullable().optional(),
  clientName: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    const parsed = joinQueueSchema.safeParse(body);
    if (!parsed.success) {
      console.error("Tentativa de manipulação de payload (Zod):", parsed.error.flatten());
      return NextResponse.json({ error: "Dados inválidos ou manipulados." }, { status: 400 });
    }

    const { barbershopId, turnstileToken, barberId, clientName: providedClientName } = parsed.data;

    // 2. VALIDAÇÃO TURNSTILE CORRIGIDA (Raiz do problema 403)
    const secretKey = process.env.TURNSTILE_SECRET_KEY;
    if (!secretKey) {
      console.error("FALHA CRÍTICA: TURNSTILE_SECRET_KEY não encontrada no .env");
      return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
    }

    // Usando URLSearchParams para garantir que os caracteres especiais do Token não quebram o POST
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", turnstileToken);

    const turnstileRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(), // <-- Isto resolve o problema de formatação!
    });
    
    const turnstileData = await turnstileRes.json();
    
    // Se a Cloudflare recusar, nós travamos com o 403 (Forbidden) e informamos o motivo no console
    if (!turnstileData.success) {
      console.error("Cloudflare bloqueou o acesso. Códigos de erro:", turnstileData["error-codes"]);
      return NextResponse.json({ error: "Falha na verificação de segurança (Anti-Bot)." }, { status: 403 });
    }

    // 3. SEGURANÇA ZERO TRUST COM O SUPABASE
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Sessão inválida. Por favor, inicie sessão novamente." }, { status: 401 });
    }

    // 4. VERIFICAÇÃO DE USUÁRIO BANIDO
    const { data: isBanned } = await supabase
      .from("banned_users")
      .select("id")
      .eq("barbershop_id", barbershopId)
      .eq("user_email", user.email)
      .maybeSingle();

    if (isBanned) {
      return NextResponse.json({ error: "Acesso bloqueado por violação das políticas do salão." }, { status: 403 });
    }

    // 5. PREVENÇÃO DE DUPLICATAS NA FILA
    const { data: alreadyInQueue } = await supabase
      .from("virtual_queue")
      .select("id")
      .eq("barbershop_id", barbershopId)
      .eq("client_auth_id", user.id)
      .in("status", ["waiting", "serving"])
      .maybeSingle();

    if (alreadyInQueue) {
      return NextResponse.json({ error: "Você já está na lista de espera!" }, { status: 409 });
    }

    // Função para abreviar o nome (Ex: Christian Carvalho -> Christian C.)
    const formatPublicName = (fullName: string) => {
      const parts = fullName.trim().split(" ");
      if (parts.length > 1) {
        return `${parts[0]} ${parts[parts.length - 1][0]}.`;
      }
      return parts[0];
    };

    const rawName = providedClientName || user.user_metadata?.full_name || user.email?.split("@")[0] || "Cliente";
    const safePublicName = formatPublicName(rawName);

    // 6. INSERÇÃO SEGURA (Mascarada e sem E-mail - LGPD By Design)
    const { error: insertError } = await supabase
      .from("virtual_queue")
      .insert({
        barbershop_id: barbershopId,
        client_auth_id: user.id,     // <-- A CHAVE DE RASTREIO DA BARBEARIA
        // client_auth_email: user.email, <-- LINHA REMOVIDA PARA EVITAR VAZAMENTO (LGPD)
        client_name: safePublicName, // <-- NOME MASCARADO (Ex: Christian C.)
        barber_id: barberId || null,
        is_authenticated: true,
        turnstile_token_used: turnstileToken,
        status: "waiting",
      });

    if (insertError) {
      console.error("Falha ao inserir na tabela virtual_queue:", insertError);
      return NextResponse.json({ error: "Erro ao registar a sua posição no banco de dados." }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("[JOIN QUEUE API CATCH ERROR]", err);
    return NextResponse.json({ error: "Erro fatal no servidor de fila." }, { status: 500 });
  }
}