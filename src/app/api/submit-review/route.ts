// src/app/api/submit-review/route.ts
export const runtime = 'edge'; // OBRIGATÓRIO NA CLOUDFLARE

import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      queueId, 
      barbershopId, 
      barberName, 
      barberRating, 
      barbershopRating, 
      comment 
    } = body;

    // Validação básica
    if (!queueId || !barbershopId || !barberRating || !barbershopRating) {
      return NextResponse.json({ success: false, error: "Dados de avaliação incompletos." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    // Insere a avaliação com as duas notas distintas
    const { error: reviewError } = await supabase
      .from("reviews")
      .insert({
        barbershop_id: barbershopId,
        client_auth_id: user?.id || null,
        barber_name: barberName || "Barbeiro",
        barber_rating: barberRating,
        barbershop_rating: barbershopRating,
        review_comment: comment?.trim() || null,
        source_type: "queue", 
        source_id: queueId
      });

    if (reviewError) throw reviewError;

    // Atualiza a flag na fila para mostrar que já foi avaliado
    const { error: queueError } = await supabase
      .from("virtual_queue")
      .update({ is_rated: true })
      .eq("id", queueId);

    if (queueError) throw queueError;
    
    return NextResponse.json({ success: true });
    
  } catch (err) {
    console.error("[REVIEW API ERROR]", err);
    return NextResponse.json({ success: false, error: "Erro ao enviar avaliação." }, { status: 500 });
  }
}