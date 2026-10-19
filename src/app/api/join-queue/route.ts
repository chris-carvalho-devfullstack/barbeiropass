// src/app/api/join-queue/route.ts
export const runtime = 'edge';

import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { CustomerRepository } from '@/infrastructure/database/supabase/CustomerRepository';
import { CustomerService } from '@/domain/customer/services/CustomerService';
import { EventLogRepository } from '@/infrastructure/database/supabase/EventLogRepository';
import { EventLogService } from '@/domain/shared/services/EventLogService';
import { TenantContext } from '@/domain/shared/TenantContext';
import {
  calculateSupabaseQueueWaitTimes,
  type PublicQueueAvailabilityStatusCode,
} from "@/infrastructure/database/supabase/SupabaseQueueWaitTimeService";

// 1. ZOD SCHEMA RIGOROSO
const joinQueueSchema = z.object({
  barbershopId: z.string().uuid("ID da barbearia inválido."),
  turnstileToken: z.string().min(1, "Token de segurança inválido."),
  barberId: z.string().uuid("ID do profissional inválido.").nullable().optional(),
  clientName: z.string().min(2, "O nome deve ter no mínimo 2 caracteres.").optional(),
  phone: z.string().optional().nullable(),
  email: z.string().email("E-mail inválido.").optional().nullable().or(z.literal("")),
  cpf: z.string().optional().nullable(),
});

function getPublicQueueUnavailableMessage(
  status: Exclude<PublicQueueAvailabilityStatusCode, "available">
): string {
  switch (status) {
    case "barbershop_closed":
      return "A fila pública está fechada no momento. Tente novamente durante o horário de funcionamento.";
    case "professionals_off_shift":
      return "No momento, não há profissionais em expediente disponíveis para receber novos clientes.";
    case "queue_unavailable":
      return "A fila pública está desativada pela barbearia.";
    case "no_availability":
      return "A fila não pode aceitar novas entradas neste momento.";
  }

  return "A fila pública não está disponível para novas entradas neste momento.";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const parsed = joinQueueSchema.safeParse(body);
    if (!parsed.success) {
      console.error("Tentativa de manipulação de payload (Zod):", parsed.error.flatten());
      return NextResponse.json({ error: "Dados inválidos. Verifique as informações preenchidas." }, { status: 400 });
    }

    const { barbershopId, turnstileToken, barberId, clientName, phone, email, cpf } = parsed.data;

    // 2. VALIDAÇÃO TURNSTILE COM BYPASS PARA LOCALHOST
    const isDevelopment = process.env.NODE_ENV === 'development';

    if (!isDevelopment && turnstileToken !== "bypass_for_localhost") {
      const secretKey = process.env.TURNSTILE_SECRET_KEY;
      if (!secretKey) {
        console.error("FALHA CRÍTICA: TURNSTILE_SECRET_KEY não encontrada no .env");
        return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
      }

      const formData = new URLSearchParams();
      formData.append("secret", secretKey);
      formData.append("response", turnstileToken);

      const turnstileRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });

      const turnstileData = await turnstileRes.json();

      if (!turnstileData.success) {
        console.error("Cloudflare bloqueou o acesso. Códigos:", turnstileData["error-codes"]);
        return NextResponse.json({ error: "Falha na verificação de segurança (Anti-Bot)." }, { status: 403 });
      }
    }

    // 3. IDENTIFICAÇÃO DO USUÁRIO
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user && !clientName) {
      return NextResponse.json({ error: "Para entrar na fila sem conta, é obrigatório informar o seu nome." }, { status: 401 });
    }

    // 4. VERIFICAÇÃO DE USUÁRIO BANIDO
    if (user) {
      const { data: isBanned } = await supabase
        .from("banned_users")
        .select("id")
        .eq("barbershop_id", barbershopId)
        .eq("user_email", user.email)
        .maybeSingle();

      if (isBanned) {
        return NextResponse.json({ error: "Acesso bloqueado por violação das políticas da barbearia." }, { status: 403 });
      }
    }

    // =========================================================================
    // MODO ADMIN: Service Role para contornar RLS
    // =========================================================================
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 5. VALIDAÇÃO DA POLÍTICA DE ACEITAÇÃO DA FILA PÚBLICA
    // Esta rota representa a entrada pública de clientes. A verificação é
    // feita antes de criar/atualizar o cliente no CRM, para não gerar registros
    // de clientes quando a fila não pode aceitar a entrada.
    // A política "accept_until_closing" permite projetar a fila para além do
    // fechamento, mas a barbearia e os profissionais elegíveis precisam estar
    // disponíveis no momento da entrada. A política restritiva também exige
    // capacidade no expediente atual, conforme calculado pelo serviço.
    const queueWaitTimeResult = await calculateSupabaseQueueWaitTimes({
      barbershopId,
      includePublicPreview: true,
    });

    const publicAvailability = queueWaitTimeResult.publicAvailability;

    if (publicAvailability.status !== "available") {
      const status = publicAvailability.status;
      const httpStatus = status === "queue_unavailable" ? 403 : 409;

      return NextResponse.json(
        {
          error: getPublicQueueUnavailableMessage(status),
          code: status,
          availability: {
            nextBusinessOpeningAt: publicAvailability.nextBusinessOpeningAt,
            businessClosesAt: publicAvailability.businessClosesAt,
            nextAvailableAt: publicAvailability.nextAvailableAt,
          },
        },
        { status: httpStatus }
      );
    }

    // 6. INTEGRAÇÃO COM O NOVO CRM (Smart Merge usando Admin Client)
    const context = {
      tenantId: barbershopId,
      userId: user?.id || null,
      role: "receptionist" as const,
    } as unknown as TenantContext;

    const customerRepo = new CustomerRepository(supabaseAdmin);
    const customerService = new CustomerService(customerRepo);
    const eventRepo = new EventLogRepository(supabaseAdmin);
    const eventService = new EventLogService(eventRepo);

    const cleanPhone = phone ? phone.replace(/\D/g, "") : null;
    const cleanCpf = cpf ? cpf.replace(/\D/g, "") : null;
    const finalName = clientName || user?.user_metadata?.full_name || "Cliente Avulso";
    const finalEmail = email || user?.email || null;

    const customer = await customerService.upsertCustomer(context, {
      name: finalName,
      phone: cleanPhone,
      email: finalEmail,
      cpf: cleanCpf,
      authUserId: user?.id || null,
      createdFrom: "QUEUE",
    });

    // 7. PREVENÇÃO DE DUPLICATAS NA FILA VIRTUAL
    let queueQuery = supabaseAdmin
      .from("virtual_queue")
      .select("id")
      .eq("barbershop_id", barbershopId)
      .in("status", ["waiting", "serving"]);

    if (user) {
      queueQuery = queueQuery.eq("client_auth_id", user.id);
    } else {
      queueQuery = queueQuery.eq("client_name", customer.name).is("client_auth_id", null);
    }

    const { data: alreadyInQueue } = await queueQuery.maybeSingle();

    if (alreadyInQueue) {
      return NextResponse.json({ error: "Você já está na lista de espera." }, { status: 409 });
    }

    const formatPublicName = (fullName: string) => {
      const parts = fullName.trim().split(" ");
      if (parts.length > 1) {
        return `${parts[0]} ${parts[parts.length - 1][0]}.`;
      }
      return parts[0];
    };
    const safePublicName = formatPublicName(customer.name);

    // 8. INSERÇÃO NA TABELA DE FILA VIRTUAL COM RETORNO DO ID DA FILA
    const { data: insertedQueue, error: insertError } = await supabaseAdmin
      .from("virtual_queue")
      .insert({
        barbershop_id: barbershopId,
        client_auth_id: user?.id || null,
        client_name: safePublicName,
        barber_id: barberId || null,
        is_authenticated: !!user,
        turnstile_token_used: turnstileToken,
        status: "waiting",
      })
      .select("id")
      .single(); // <-- ESSENCIAL: Retorna a linha gravada

    if (insertError) {
      console.error("Falha ao inserir na tabela virtual_queue:", insertError);
      return NextResponse.json({ error: "Erro ao registar a sua posição na fila." }, { status: 500 });
    }

    // 9. AUDITORIA E TIMELINE
    await eventService.logEvent(context, {
      entityType: 'QUEUE',
      entityId: customer.id,
      eventType: 'QUEUE_ENTERED',
      payload: {
        barberId: barberId || "Sem Preferência",
        isAuthenticated: !!user,
        source: "VIRTUAL_QUEUE_PUBLIC_LINK",
        providedPhone: cleanPhone
      }
    });

    // RETORNA O queueId PARA O FRONTEND CONSEGUIR LIGAR O "ACOMPANHAMENTO AO VIVO"
    return NextResponse.json({ success: true, customerId: customer.id, queueId: insertedQueue.id });

  } catch (err) {
    console.error("[JOIN QUEUE API CATCH ERROR]", err);
    return NextResponse.json({ error: "Erro fatal no servidor de fila." }, { status: 500 });
  }
}
