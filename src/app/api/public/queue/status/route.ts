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

const querySchema = z.object({ slug: publicSlugSchema });

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({ slug: url.searchParams.get("slug") });
    
    if (!parsed.success) {
      return NextResponse.json({ error: "Link da barbearia inválido." }, { status: 400 });
    }

    const admin = createAdminClient();
    const barbershop = await resolvePublicBarbershop(admin, parsed.data.slug);
    
    if (!barbershop) {
      return NextResponse.json({ error: "Barbearia não encontrada." }, { status: 404 });
    }

    // 1. Sempre buscamos a contagem total de pessoas na fila, independente de ticket
    const { count: waitingCount, error: countError } = await admin
      .from("virtual_queue")
      .select("id", { count: "exact", head: true })
      .eq("barbershop_id", barbershop.id)
      .eq("status", "waiting");
      
    if (countError) throw new Error("Não foi possível consultar a fila.");

    // 2. Verificamos se o usuário tem um cookie de acesso à fila
    const token = request.headers
      .get("cookie")
      ?.split(";")
      .map((value) => value.trim())
      .find((value) => value.startsWith(`${PUBLIC_QUEUE_ACCESS_COOKIE}=`))
      ?.slice(`${PUBLIC_QUEUE_ACCESS_COOKIE}=`.length);

    let ticket = null;
    let position: number | null = null;
    let responseMustClearCookie = false;

    // 3. Se ele tiver o cookie, tentamos validar o ticket dele
    if (token) {
      ticket = await getOwnedPublicQueueTicket(admin, token, barbershop.id);
      
      if (!ticket) {
        // O cookie existe, mas é velho ou inválido. Não damos 404, apenas limpamos o cookie.
        responseMustClearCookie = true;
      } else if (ticket.status === "waiting" && ticket.joined_at) {
        // Se tem ticket válido e está esperando, calcula a posição
        const { count: aheadCount, error: positionError } = await admin
          .from("virtual_queue")
          .select("id", { count: "exact", head: true })
          .eq("barbershop_id", barbershop.id)
          .eq("status", "waiting")
          .lte("joined_at", ticket.joined_at);
          
        if (!positionError) {
          position = aheadCount ?? null;
        }
      }
    }

    // 4. Montamos o payload estruturado exatamente como o front-end espera
    const response = NextResponse.json(
      {
        waitingCount: waitingCount ?? 0,
        myPosition: position,
        ticket: ticket ? {
          id: ticket.id,
          status: ticket.status,
          barber_name: ticket.barber_name,
          chair_number: ticket.chair_number,
          is_rated: ticket.is_rated,
          joined_at: ticket.joined_at
        } : null
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );

    // Se o cookie estava obsoleto, a gente limpa do navegador do cliente silenciosamente
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