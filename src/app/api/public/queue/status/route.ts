// src/app/api/public/queue/status/route.ts
export const runtime = "edge";

import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/utils/supabase/admin";

import {
  clearPublicQueueAccessCookie,
  getOwnedPublicQueueTicket,
  publicSlugSchema,
  resolvePublicBarbershop,
} from "@/app/api/public/_shared";

import { PUBLIC_QUEUE_ACCESS_COOKIE } from "@/lib/public-queue-security";

import { calculateSupabaseQueueWaitTimes } from "@/infrastructure/database/supabase/SupabaseQueueWaitTimeService";

const querySchema = z.object({
  slug: publicSlugSchema,
});

const PUBLIC_PREVIEW_TICKET_ID = "__public_queue_preview__";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const parsed = querySchema.safeParse({
      slug: url.searchParams.get("slug"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Link da barbearia inválido." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
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

    // O cookie contém um token HttpOnly, validado no servidor.
    const token = request.headers
      .get("cookie")
      ?.split(";")
      .map((value) => value.trim())
      .find((value) =>
        value.startsWith(`${PUBLIC_QUEUE_ACCESS_COOKIE}=`)
      )
      ?.slice(`${PUBLIC_QUEUE_ACCESS_COOKIE}=`.length);

    let ticket:
      Awaited<ReturnType<typeof getOwnedPublicQueueTicket>> = null;

    let responseMustClearCookie = false;

    if (token) {
      ticket = await getOwnedPublicQueueTicket(
        admin,
        token,
        barbershop.id
      );

      if (!ticket) {
        // Token inválido ou expirado: limpar sem expor informações.
        responseMustClearCookie = true;
      }
    }

    // Um visitante sem ticket recebe uma validação rápida antes de qualquer
    // simulação pública. Quem já tem ticket válido continua recebendo a
    // estimativa individual, mas não precisa de um ticket virtual adicional.
    const queueState = await calculateSupabaseQueueWaitTimes({
      barbershopId: barbershop.id,
      timeZone: "America/Sao_Paulo",
      daysAhead: 1,
      includePublicPreview: !ticket,
    });

    const previewEstimate = !ticket
      ? queueState.estimate.estimates.find(
          (estimate) =>
            estimate.ticketId === PUBLIC_PREVIEW_TICKET_ID
        ) ?? null
      : null;

    // Só procuramos a estimativa individual do ticket depois de validar
    // o cookie de posse e somente quando o cliente ainda está aguardando.
    const myEstimate =
      ticket?.status === "waiting"
        ? queueState.estimate.estimates.find(
            (estimate) => estimate.ticketId === ticket?.id
          ) ?? null
        : null;

    const response = NextResponse.json(
      {
        waitingCount: queueState.waitingCount,

        myPosition: myEstimate?.position ?? null,
        peopleAhead: myEstimate?.peopleAhead ?? null,

        myEstimate: myEstimate
          ? {
              position: myEstimate.position,
              peopleAhead: myEstimate.peopleAhead,
              estimatedWaitMinutes:
                myEstimate.estimatedWaitMinutes,
              estimatedStartAt:
                myEstimate.estimatedStartAt,
              projectedBarberName:
                myEstimate.projectedBarberName,
              usesAlternativeBarber:
                myEstimate.usesAlternativeBarber,
              preferredBarberPosition:
                myEstimate.preferredBarberPosition,
              preferredBarberPeopleAhead:
                myEstimate.preferredBarberPeopleAhead,
            }
          : null,

        // Dados agregados para a consulta pública antes do check-in.
        // Não são incluídos IDs de tickets ou dados de outros clientes.
        queueEstimate: {
          estimatedWaitMinutes:
            previewEstimate?.estimatedWaitMinutes ?? null,
          estimatedStartAt:
            previewEstimate?.estimatedStartAt ?? null,
          eligibleBarberCount:
            queueState.eligibleBarberCount,
          eligibleBarberIds: queueState.estimate.barbers
            .filter((barber) => barber.eligibleForNewClients)
            .map((barber) => barber.barberId),
          acceptsQueue:
            queueState.barbershopAcceptsQueue,
          availabilityReason:
            queueState.publicAvailability.reason,
          publicAvailability: queueState.publicAvailability,
        },

        // Contrato anterior mantido para não quebrar o fluxo existente.
        // Este objeto contém apenas o ticket validado pelo cookie.
        ticket: ticket
          ? {
              id: ticket.id,
              status: ticket.status,
              client_auth_id: ticket.client_auth_id,
              barber_name: ticket.barber_name,
              chair_number: ticket.chair_number,
              is_rated: ticket.is_rated,
              joined_at: ticket.joined_at,
              cancellation_type: ticket.cancellation_source,
            }
          : null,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );

    if (responseMustClearCookie) {
      return clearPublicQueueAccessCookie(response);
    }

    return response;
  } catch (error) {
    console.error("[PUBLIC_QUEUE_STATUS]", error);

    return NextResponse.json(
      { error: "Não foi possível consultar o status." },
      { status: 500 }
    );
  }
}
