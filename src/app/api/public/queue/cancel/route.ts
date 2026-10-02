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

const cancelSchema = z.object({ slug: publicSlugSchema });

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
    const parsed = cancelSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados invÃ¡lidos." }, { status: 400 });
    }

    const admin = createAdminClient();
    const withinLimit = await consumePublicRateLimit(
      admin,
      request,
      "public_queue_cancel",
      parsed.data.slug,
      10,
      10 * 60
    );
    if (!withinLimit) {
      return NextResponse.json({ error: "Muitas tentativas." }, { status: 429 });
    }

    const barbershop = await resolvePublicBarbershop(admin, parsed.data.slug);
    if (!barbershop) {
      return NextResponse.json({ error: "Barbearia nÃ£o encontrada." }, { status: 404 });
    }

    const token = getCookie(request, PUBLIC_QUEUE_ACCESS_COOKIE);
    const ticket = await getOwnedPublicQueueTicket(admin, token, barbershop.id);
    if (!ticket || !token) {
      return NextResponse.json({ error: "Ticket nÃ£o encontrado." }, { status: 404 });
    }

    if (ticket.status !== "waiting") {
      return NextResponse.json(
        { error: "Este atendimento nÃ£o pode mais ser cancelado." },
        { status: 409 }
      );
    }

    const { error: updateError } = await admin
      .from("virtual_queue")
      .update({ status: "canceled" })
      .eq("id", ticket.id)
      .eq("barbershop_id", barbershop.id)
      .eq("status", "waiting");
    if (updateError) throw new Error("NÃ£o foi possÃ­vel cancelar o ticket.");

    await revokePublicQueueToken(admin, token, barbershop.id);
    const response = NextResponse.json({ success: true });
    return clearPublicQueueAccessCookie(response);
  } catch (error) {
    console.error("[PUBLIC_QUEUE_CANCEL]", error);
    return NextResponse.json(
      { error: "NÃ£o foi possÃ­vel cancelar o ticket." },
      { status: 500 }
    );
  }
}
