// src/app/api/submit-review/route.ts
export const runtime = 'edge'; // OBRIGATÓRIO NA CLOUDFLARE

import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
// 1. IMPORTAÇÃO NOVA PARA LIMPAR O CACHE
import { revalidatePath } from "next/cache"; 

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
    
    // Insere a avaliação 
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
    
    // 2. >>> A MÁGICA QUE RESOLVE O BUG <<<
    // Dizemos ao Next.js para limpar o cache da página da barbearia
    // Assim, ao dar reload, a página verá que `is_rated` é true e pulará essa avaliação.
    revalidatePath("/b/[slug]", "page");
    revalidatePath("/fila"); // Limpa o cache do painel do barbeiro também
    
    return NextResponse.json({ success: true });
    
  } catch (err) {
    console.error("[REVIEW API ERROR]", err);
    return NextResponse.json({ success: false, error: "Erro ao enviar avaliação." }, { status: 500 });
  }
}