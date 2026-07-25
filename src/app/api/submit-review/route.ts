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
      comment,
      skipped // <--- Pegando a nova flag enviada pelo frontend
    } = body;

    // Validação básica de IDs (Sempre obrigatórios)
    if (!queueId || !barbershopId) {
      return NextResponse.json({ success: false, error: "Identificação da fila ausente." }, { status: 400 });
    }

    // Se NÃO pulou, as notas são obrigatórias
    if (!skipped && (!barberRating || !barbershopRating)) {
      return NextResponse.json({ success: false, error: "Dados de avaliação incompletos." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    // Só insere na tabela de reviews se o usuário NÃO pulou
    if (!skipped) {
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
    }

    // Atualiza a flag na fila para mostrar que já foi avaliado (ou "pulado")
    // É ISSO AQUI que diz pro sistema não abrir a tela nunca mais.
    const { error: queueError } = await supabase
      .from("virtual_queue")
      .update({ is_rated: true })
      .eq("id", queueId);

    if (queueError) throw queueError;
    
    // 2. >>> A MÁGICA QUE RESOLVE O BUG <<<
    // Limpamos o cache geral de rotas. Assim, quando o usuário der F5,
    // o page.tsx no servidor buscará os dados frescos no banco de dados
    // em vez de pegar a página do cache do Next.js.
    revalidatePath('/', 'layout'); 
    
    return NextResponse.json({ success: true });
    
  } catch (err) {
    console.error("[REVIEW API ERROR]", err);
    return NextResponse.json({ success: false, error: "Erro ao enviar avaliação." }, { status: 500 });
  }
}