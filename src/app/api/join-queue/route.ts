// src/app/api/join-queue/route.ts
export const runtime = 'edge'; // OBRIGATÓRIO NA CLOUDFLARE

import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

// Zod Schema: Blindagem de entrada
const joinQueueSchema = z.object({
  barbershopId: z.string().uuid("ID da barbearia inválido."),
  turnstileToken: z.string().min(1, "Token de segurança ausente."),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // 1. Valida o formato dos dados
    const parsed = joinQueueSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos ou manipulados." }, { status: 400 });
    }

    const { barbershopId, turnstileToken } = parsed.data;

    // 2. Validação Secreta do Cloudflare Turnstile
    const turnstileEndpoint = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
    const secretKey = process.env.TURNSTILE_SECRET_KEY;

    if (!secretKey) {
      return NextResponse.json({ error: "Erro de configuração no servidor." }, { status: 500 });
    }

    const turnstileRes = await fetch(turnstileEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${secretKey}&response=${turnstileToken}`,
    });
    
    const turnstileData = await turnstileRes.json();
    if (!turnstileData.success) {
      return NextResponse.json({ error: "Falha na verificação de segurança. O sistema suspeita de tráfego automatizado." }, { status: 403 });
    }

    // 3. Validação de Identidade (Zero Trust com Supabase)
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Sessão inválida. Por favor, inicie sessão novamente." }, { status: 401 });
    }

    // -- AQUI VOCÊ PODE APLICAR SUA LÓGICA DE RATE LIMIT NO FUTURO --
    // Exemplo: checkRateLimit(user.id) ... se falhar: return erro 429 (Too Many Requests)

    // 4. Verificação da Banlist
    const { data: isBanned } = await supabase
      .from("banned_users")
      .select("id")
      .eq("barbershop_id", barbershopId)
      .eq("user_email", user.email)
      .maybeSingle();

    if (isBanned) {
      return NextResponse.json({ error: "Acesso bloqueado." }, { status: 403 });
    }

    // 5. Prevenção de Duplicata
    const { data: alreadyInQueue } = await supabase
      .from("virtual_queue")
      .select("id")
      .eq("barbershop_id", barbershopId)
      .eq("client_auth_id", user.id)
      .eq("status", "waiting")
      .maybeSingle();

    if (alreadyInQueue) {
      return NextResponse.json({ error: "Você já está a aguardar nesta fila!" }, { status: 409 });
    }

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
        turnstile_token_used: turnstileToken,
        status: "waiting",
      });

    if (insertError) {
      return NextResponse.json({ error: "Ocorreu um erro ao registar a sua posição. Tente novamente." }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("[JOIN QUEUE API ERROR]", err);
    return NextResponse.json({ error: "Erro interno no servidor de fila." }, { status: 500 });
  }
}