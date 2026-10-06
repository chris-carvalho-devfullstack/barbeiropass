export const runtime = "edge";

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  clearPublicQueueAccessCookie,
  consumePublicRateLimit,
  getOwnedPublicQueueTicket,
  publicSlugSchema,
  resolvePublicBarbershop,
  revokePublicQueueToken,
} from "@/app/api/public/_shared";
import { PUBLIC_QUEUE_ACCESS_COOKIE } from "@/lib/public-queue-security";

const dismissSchema = z.object({
  slug: publicSlugSchema,
});

function getCookie(request: Request, name: string): string | undefined {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = dismissSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const withinLimit = await consumePublicRateLimit(
      admin,
      request,
      "public_queue_dismiss",
      parsed.data.slug,
      10,
      10 * 60
    );

    if (!withinLimit) {
      return NextResponse.json(
        { error: "Muitas tentativas." },
        { status: 429 }
      );
    }

    const barbershop = await resolvePublicBarbershop(
      admin,
      parsed.data.slug
    );

    if (!barbershop) {
      return NextResponse.json(
        { error: "Barbearia não encontrada." },
        { status: 404 }
      );
    }

    const token = getCookie(request, PUBLIC_QUEUE_ACCESS_COOKIE);

    if (!token) {
      return clearPublicQueueAccessCookie(
        NextResponse.json({ success: true })
      );
    }

    const ticket = await getOwnedPublicQueueTicket(
      admin,
      token,
      barbershop.id
    );

    if (!ticket) {
      return clearPublicQueueAccessCookie(
        NextResponse.json({ success: true })
      );
    }

    const terminalStatuses = [
      "awaiting_payment",
      "completed",
      "finished",
      "cancelled",
    ];

    if (!terminalStatuses.includes(ticket.status)) {
      return NextResponse.json(
        { error: "Este atendimento ainda não pode ser dispensado." },
        { status: 409 }
      );
    }

    await revokePublicQueueToken(
      admin,
      token,
      barbershop.id
    );

    return clearPublicQueueAccessCookie(
      NextResponse.json({ success: true })
    );
  } catch (error) {
    console.error("[PUBLIC_QUEUE_DISMISS]", error);

    return NextResponse.json(
      { error: "Não foi possível encerrar esta visualização." },
      { status: 500 }
    );
  }
}