import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  PUBLIC_QUEUE_ACCESS_COOKIE,
  PUBLIC_QUEUE_ACCESS_TTL_SECONDS,
  getRateLimitSubject,
  sha256,
} from "@/lib/public-queue-security";

export const publicSlugSchema = z
  .string()
  .trim()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Link da barbearia inválido.");

type AdminClient = ReturnType<typeof createAdminClient>;

export type PublicBarbershop = {
  id: string;
  name: string;
};

export type PublicQueueTicket = {
  id: string;
  barbershop_id: string;
  client_id: string | null;
  client_auth_id: string | null;
  status: string;
  barber_name: string | null;
  chair_number: string | null;
  is_rated: boolean;
  joined_at: string | null;
};

export async function resolvePublicBarbershop(
  admin: AdminClient,
  slug: string
): Promise<PublicBarbershop | null> {
  const { data, error } = await admin
    .from("barbershops")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error("NÃ£o foi possÃ­vel identificar a barbearia.");
  }

  return data;
}

export async function consumePublicRateLimit(
  admin: AdminClient,
  request: Request,
  scope: string,
  slug: string,
  maxAttempts: number,
  windowSeconds: number
): Promise<boolean> {
  const subjectHash = await getRateLimitSubject(request, scope, slug);
  const { data, error } = await admin.rpc("consume_public_rate_limit", {
    p_scope: scope,
    p_subject_hash: subjectHash,
    p_max_attempts: maxAttempts,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    throw new Error("NÃ£o foi possÃ­vel validar o limite de tentativas.");
  }

  return data === true;
}

export function setPublicQueueAccessCookie(
  response: NextResponse,
  token: string
): NextResponse {
  response.cookies.set(PUBLIC_QUEUE_ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/public/queue",
    maxAge: PUBLIC_QUEUE_ACCESS_TTL_SECONDS,
  });

  return response;
}

export function clearPublicQueueAccessCookie(response: NextResponse): NextResponse {
  response.cookies.set(PUBLIC_QUEUE_ACCESS_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/public/queue",
    maxAge: 0,
  });

  return response;
}

export async function getOwnedPublicQueueTicket(
  admin: AdminClient,
  token: string | undefined,
  barbershopId: string
): Promise<PublicQueueTicket | null> {
  if (!token) return null;

  const tokenHash = await sha256(token);
  const { data: access, error: accessError } = await admin
    .from("public_queue_access_tokens")
    .select("queue_id")
    .eq("token_hash", tokenHash)
    .eq("barbershop_id", barbershopId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (accessError) {
    throw new Error("NÃ£o foi possÃ­vel validar o acesso ao ticket.");
  }

  if (!access) return null;

  const { data: ticket, error: ticketError } = await admin
    .from("virtual_queue")
    .select(
      "id, barbershop_id, client_id, client_auth_id, status, barber_name, chair_number, is_rated, joined_at"
    )
    .eq("id", access.queue_id)
    .eq("barbershop_id", barbershopId)
    .maybeSingle();

  if (ticketError) {
    throw new Error("NÃ£o foi possÃ­vel localizar o ticket.");
  }

  return ticket as PublicQueueTicket | null;
}

export async function revokePublicQueueToken(
  admin: AdminClient,
  token: string,
  barbershopId: string
): Promise<void> {
  const tokenHash = await sha256(token);
  const { error } = await admin
    .from("public_queue_access_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token_hash", tokenHash)
    .eq("barbershop_id", barbershopId)
    .is("revoked_at", null);

  if (error) {
    throw new Error("NÃ£o foi possÃ­vel encerrar o acesso ao ticket.");
  }
}
