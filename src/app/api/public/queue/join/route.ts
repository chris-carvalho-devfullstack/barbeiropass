export const runtime = "edge";

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { CustomerRepository } from "@/infrastructure/database/supabase/CustomerRepository";
import { EventLogRepository } from "@/infrastructure/database/supabase/EventLogRepository";
import { CustomerService } from "@/domain/customer/services/CustomerService";
import { EventLogService } from "@/domain/shared/services/EventLogService";
import { TenantContext } from "@/domain/shared/TenantContext";
import {
  consumePublicRateLimit,
  publicSlugSchema,
  resolvePublicBarbershop,
  setPublicQueueAccessCookie,
} from "@/app/api/public/_shared";
import {
  PUBLIC_QUEUE_ACCESS_TTL_SECONDS,
  createPublicQueueAccessToken,
  sha256,
} from "@/lib/public-queue-security";

const joinQueueSchema = z.object({
  slug: publicSlugSchema,
  turnstileToken: z.string().min(1, "Token anti-bot invÃ¡lido."),
  barberId: z.string().uuid().nullable().optional(),
  clientName: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  email: z.string().trim().email().max(254).nullable().optional().or(z.literal("")),
  cpf: z.string().trim().max(20).nullable().optional(),
});

async function verifyTurnstile(token: string, request: Request): Promise<boolean> {
  if (process.env.NODE_ENV === "development" && token === "bypass_for_localhost") {
    return true;
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    throw new Error("ConfiguraÃ§Ã£o anti-bot indisponÃ­vel.");
  }

  const formData = new URLSearchParams({ secret, response: token });
  const remoteIp = request.headers.get("cf-connecting-ip");
  if (remoteIp) formData.set("remoteip", remoteIp);

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    }
  );

  const result = (await response.json()) as { success?: boolean };
  return result.success === true;
}

function toPublicName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts.at(-1)?.[0]}.` : parts[0];
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = joinQueueSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Dados invÃ¡lidos." }, { status: 400 });
    }

    const { slug, turnstileToken, barberId, clientName, phone, email, cpf } = parsed.data;
    const admin = createAdminClient();
    const withinLimit = await consumePublicRateLimit(
      admin,
      request,
      "public_queue_join",
      slug,
      8,
      10 * 60
    );

    if (!withinLimit) {
      return NextResponse.json(
        { error: "Muitas tentativas. Aguarde alguns minutos." },
        { status: 429 }
      );
    }

    if (!(await verifyTurnstile(turnstileToken, request))) {
      return NextResponse.json({ error: "ValidaÃ§Ã£o anti-bot recusada." }, { status: 403 });
    }

    const barbershop = await resolvePublicBarbershop(admin, slug);
    if (!barbershop) {
      return NextResponse.json({ error: "Barbearia nÃ£o encontrada." }, { status: 404 });
    }

    if (barberId) {
      const { data: barber, error: barberError } = await admin
        .from("staff")
        .select("id")
        .eq("id", barberId)
        .eq("barbershop_id", barbershop.id)
        .eq("role", "barber")
        .eq("is_active", true)
        .maybeSingle();

      if (barberError || !barber) {
        return NextResponse.json({ error: "Profissional indisponÃ­vel." }, { status: 400 });
      }
    }

    const sessionClient = await createClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    if (!user && !clientName) {
      return NextResponse.json(
        { error: "Informe seu nome para entrar na fila." },
        { status: 400 }
      );
    }

    if (user?.email) {
      const { data: banned, error: bannedError } = await admin
        .from("banned_users")
        .select("id")
        .eq("barbershop_id", barbershop.id)
        .eq("user_email", user.email)
        .maybeSingle();

      if (bannedError) throw new Error("NÃ£o foi possÃ­vel validar o acesso.");
      if (banned) {
        return NextResponse.json({ error: "Acesso bloqueado." }, { status: 403 });
      }
    }

    const cleanPhone = phone ? phone.replace(/\D/g, "") : null;
    const cleanCpf = cpf ? cpf.replace(/\D/g, "") : null;
    const fullName = clientName || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Cliente";
    const finalEmail = email || user?.email || null;
    const context: TenantContext = {
      tenantId: barbershop.id,
      userId: user?.id ?? null,
      role: "public_customer",
    };

    const customerService = new CustomerService(new CustomerRepository(admin));
    const customer = await customerService.upsertCustomer(context, {
      name: fullName,
      phone: cleanPhone,
      email: finalEmail,
      cpf: cleanCpf,
      authUserId: user?.id ?? null,
      createdFrom: "QUEUE",
    });

    const activeStatuses = ["waiting", "serving", "in_progress", "in_chair"];
    let duplicateQuery = admin
      .from("virtual_queue")
      .select("id")
      .eq("barbershop_id", barbershop.id)
      .in("status", activeStatuses);

    duplicateQuery = user
      ? duplicateQuery.eq("client_auth_id", user.id)
      : duplicateQuery.eq("client_id", customer.id);

    const { data: existingTicket, error: duplicateError } = await duplicateQuery.maybeSingle();
    if (duplicateError) throw new Error("NÃ£o foi possÃ­vel validar a fila atual.");

    if (existingTicket) {
      return NextResponse.json(
        { error: "JÃ¡ existe um atendimento ativo para este cliente." },
        { status: 409 }
      );
    }

    const queueId = crypto.randomUUID();
    const accessToken = createPublicQueueAccessToken();
    const tokenHash = await sha256(accessToken);
    const expiresAt = new Date(
      Date.now() + PUBLIC_QUEUE_ACCESS_TTL_SECONDS * 1000
    ).toISOString();

    const { error: queueError } = await admin.from("virtual_queue").insert({
      id: queueId,
      barbershop_id: barbershop.id,
      client_id: customer.id,
      client_auth_id: user?.id ?? null,
      client_name: toPublicName(customer.name),
      barber_id: barberId ?? null,
      is_authenticated: Boolean(user),
      status: "waiting",
    });

    if (queueError) throw new Error("NÃ£o foi possÃ­vel criar o ticket.");

    const { error: tokenError } = await admin.from("public_queue_access_tokens").insert({
      queue_id: queueId,
      barbershop_id: barbershop.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    if (tokenError) {
      await admin
        .from("virtual_queue")
        .update({ status: "canceled" })
        .eq("id", queueId)
        .eq("barbershop_id", barbershop.id);
      throw new Error("NÃ£o foi possÃ­vel proteger o ticket.");
    }

    try {
      const eventService = new EventLogService(new EventLogRepository(admin));
      await eventService.logEvent(context, {
        entityType: "CUSTOMER",
        entityId: customer.id,
        eventType: "QUEUE_ENTERED",
        performedBy: user?.id ?? null,
        payload: { queueId, source: "PUBLIC_QUEUE" },
      });
    } catch (eventError) {
      await admin
        .from("public_queue_access_tokens")
        .update({ revoked_at: new Date().toISOString() })
        .eq("queue_id", queueId);
      await admin
        .from("virtual_queue")
        .update({ status: "canceled" })
        .eq("id", queueId)
        .eq("barbershop_id", barbershop.id);
      throw eventError;
    }

    const response = NextResponse.json(
      { success: true, data: { status: "waiting" } },
      { status: 201 }
    );

    return setPublicQueueAccessCookie(response, accessToken);
  } catch (error) {
    console.error("[PUBLIC_QUEUE_JOIN]", error);
    return NextResponse.json(
      { error: "Não foi possível entrar na fila." },
      { status: 500 }
    );
  }
}
