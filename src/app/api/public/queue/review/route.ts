export const runtime = "edge";

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  consumePublicRateLimit,
  getOwnedPublicQueueTicket,
  publicSlugSchema,
  resolvePublicBarbershop,
} from "@/app/api/public/_shared";
import { PUBLIC_QUEUE_ACCESS_COOKIE } from "@/lib/public-queue-security";

const reviewSchema = z.object({
  slug: publicSlugSchema,
  skipped: z.boolean().default(false),
  barberRating: z.number().int().min(1).max(5).optional(),
  barbershopRating: z.number().int().min(1).max(5).optional(),
  comment: z.string().trim().max(1000).optional(),
}).superRefine((value, context) => {
  if (!value.skipped && (!value.barberRating || !value.barbershopRating)) {
    context.addIssue({ code: "custom", message: "AvaliaÃ§Ãµes sÃ£o obrigatÃ³rias." });
  }
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
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "AvaliaÃ§Ã£o invÃ¡lida." }, { status: 400 });
    }

    const admin = createAdminClient();
    const withinLimit = await consumePublicRateLimit(
      admin,
      request,
      "public_queue_review",
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
    if (!ticket) {
      return NextResponse.json({ error: "Ticket nÃ£o encontrado." }, { status: 404 });
    }

    const terminalStatuses = ["awaiting_payment", "completed", "finished"];
    if (!terminalStatuses.includes(ticket.status) || ticket.is_rated) {
      return NextResponse.json(
        { error: "Este atendimento nÃ£o estÃ¡ disponÃ­vel para avaliaÃ§Ã£o." },
        { status: 409 }
      );
    }

    if (!parsed.data.skipped) {
      const { error: reviewError } = await admin.from("reviews").insert({
        barbershop_id: barbershop.id,
        client_auth_id: ticket.client_auth_id,
        barber_name: ticket.barber_name ?? "Profissional",
        barber_rating: parsed.data.barberRating,
        barbershop_rating: parsed.data.barbershopRating,
        review_comment: parsed.data.comment || null,
        source_type: "queue",
        source_id: ticket.id,
      });

      if (reviewError) throw new Error("NÃ£o foi possÃ­vel registrar a avaliaÃ§Ã£o.");
    }

    const { error: queueError } = await admin
      .from("virtual_queue")
      .update({ is_rated: true })
      .eq("id", ticket.id)
      .eq("barbershop_id", barbershop.id)
      .eq("is_rated", false);
    if (queueError) throw new Error("NÃ£o foi possÃ­vel finalizar a avaliaÃ§Ã£o.");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PUBLIC_QUEUE_REVIEW]", error);
    return NextResponse.json(
      { error: "NÃ£o foi possÃ­vel enviar a avaliaÃ§Ã£o." },
      { status: 500 }
    );
  }
}
