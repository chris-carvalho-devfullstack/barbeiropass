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
      return NextResponse.json(
        { error: "Dados inválidos. Verifique as informações preenchidas." },
        { status: 400 }
      );
    }

    const { barbershopId, turnstileToken, barberId, clientName, phone, email, cpf } = parsed.data;

    // Validação Turnstile, mantendo o bypass exclusivo do ambiente de desenvolvimento.
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

    // Identificação do usuário autenticado, quando existir.
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user && !clientName) {
      return NextResponse.json(
        { error: "Para entrar na fila sem conta, é obrigatório informar o seu nome." },
        { status: 401 }
      );
    }

    if (user) {
      const { data: isBanned } = await supabase
        .from("banned_users")
        .select("id")
        .eq("barbershop_id", barbershopId)
        .eq("user_email", user.email)
        .maybeSingle();

      if (isBanned) {
        return NextResponse.json(
          { error: "Acesso bloqueado por violação das políticas da barbearia." },
          { status: 403 }
        );
      }
    }

    // O Admin Client é usado apenas no servidor para operações CRM e validações públicas.
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // A preferência precisa apontar para um profissional ativo da mesma barbearia.
    // Ela será salva em preferred_barber_id; barber_id só é preenchido ao iniciar atendimento.
    if (barberId) {
      const { data: preferredBarber, error: preferredBarberError } = await supabaseAdmin
        .from("staff")
        .select("id")
        .eq("id", barberId)
        .eq("barbershop_id", barbershopId)
        .eq("role", "barber")
        .eq("is_active", true)
        .maybeSingle();

      if (preferredBarberError) {
        console.error("[QUEUE_PREFERRED_BARBER_LOOKUP_ERROR]", preferredBarberError);
        return NextResponse.json({ error: "Não foi possível validar o profissional escolhido." }, { status: 500 });
      }

      if (!preferredBarber) {
        return NextResponse.json(
          { error: "O profissional escolhido não está ativo ou não pertence a esta barbearia." },
          { status: 400 }
        );
      }
    }

    // Verifica se a fila pública pode receber novas entradas antes de criar registros no CRM.
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

    // Integração com CRM usando o contexto da barbearia.
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

    // Impede duplicar a mesma pessoa na fila, autenticada ou avulsa.
    let queueQuery = supabaseAdmin
      .from("virtual_queue")
      .select("id")
      .eq("barbershop_id", barbershopId)
      .in("status", ["waiting", "serving", "in_progress"]);

    if (user) {
      queueQuery = queueQuery.eq("client_auth_id", user.id);
    } else {
      queueQuery = queueQuery.eq("client_name", customer.name).is("client_auth_id", null);
    }

    const { data: alreadyInQueue, error: existingQueueError } = await queueQuery.maybeSingle();

    if (existingQueueError) {
      console.error("[QUEUE_DUPLICATE_LOOKUP_ERROR]", existingQueueError);
      return NextResponse.json({ error: "Não foi possível verificar sua posição na fila." }, { status: 500 });
    }

    if (alreadyInQueue) {
      return NextResponse.json({ error: "Você já está na lista de espera." }, { status: 409 });
    }

    const formatPublicName = (fullName: string) => {
      const parts = fullName.trim().split(" ");
      if (parts.length > 1) return `${parts[0]} ${parts[parts.length - 1][0]}.`;
      return parts[0];
    };
    const safePublicName = formatPublicName(customer.name);

    // Preserva a preferência do cliente separada do barbeiro que efetivamente atenderá.
    const { data: insertedQueue, error: insertError } = await supabaseAdmin
      .from("virtual_queue")
      .insert({
        barbershop_id: barbershopId,
        client_id: customer.id,
        client_auth_id: user?.id || null,
        client_name: safePublicName,
        barber_id: null,
        preferred_barber_id: barberId || null,
        barber_name: null,
        is_authenticated: !!user,
        turnstile_token_used: turnstileToken,
        status: "waiting",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Falha ao inserir na tabela virtual_queue:", insertError);
      return NextResponse.json({ error: "Erro ao registar a sua posição na fila." }, { status: 500 });
    }

    await eventService.logEvent(context, {
      entityType: 'QUEUE',
      entityId: customer.id,
      eventType: 'QUEUE_ENTERED',
      payload: {
        preferredBarberId: barberId || null,
        isAuthenticated: !!user,
        source: "VIRTUAL_QUEUE_PUBLIC_LINK",
        providedPhone: cleanPhone,
      },
    });

    return NextResponse.json({
      success: true,
      customerId: customer.id,
      queueId: insertedQueue.id,
    });
  } catch (err) {
    console.error("[JOIN QUEUE API CATCH ERROR]", err);
    return NextResponse.json({ error: "Erro fatal no servidor de fila." }, { status: 500 });
  }
}
