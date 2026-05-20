// src/app/(dashboard)/fila/actions.ts
"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// 1. Entrar na Fila (Ação Legada/Interna)
export async function joinQueueAction(data: { 
  barbershop_id: string; 
  client_name: string; 
  client_id?: string | null; 
}) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("virtual_queue")
    .insert({
      barbershop_id: data.barbershop_id,
      client_name: data.client_name,
      client_id: data.client_id || null,
      status: 'waiting'
    });

  if (error) {
    console.error("Erro ao entrar na fila:", error.message);
    return { error: "Erro ao entrar na fila." };
  }

  revalidatePath("/fila");
  revalidatePath("/pdv");
  
  return { success: true };
}

// 2. Atualizar Status (Para uso interno da Barbearia)
export async function updateQueueStatusAction(id: string, status: string) {
  const supabase = await createClient();
  
  // Tipagem estrita para evitar o uso de 'any'
  type QueueUpdatePayload = {
    status: string;
    barber_name?: string;
    chair_number?: string;
  };

  // Objeto base de atualização
  const updateData: QueueUpdatePayload = { status };

  // Se o barbeiro estiver a chamar o cliente para a cadeira agora
  if (status === "in_progress") {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Captura o nome humanizado do barbeiro logado no painel interno
      const barberName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Barbeiro";
      
      updateData.barber_name = barberName;
      // Caso queira expandir para cadeiras fixas por membro futuramente, o campo já fica mapeado
      updateData.chair_number = "01"; 
    }
  }

  const { error } = await supabase
    .from("virtual_queue")
    .update(updateData)
    .eq("id", id);

  if (error) return { error: "Erro ao atualizar status." };

  // Força a limpeza de cache do Next.js nas rotas críticas
  revalidatePath("/fila");
  revalidatePath("/pdv");
  revalidatePath("/b/[slug]", "page"); 
  
  return { success: true };
}

// =========================================================================
// NOVAS AÇÕES DA TORRE DE COMANDO (Dashboard)
// =========================================================================

// 3. Inserir cliente manualmente na fila (O "Sem Telemóvel")
export async function addManualClientAction(barbershopId: string, clientName: string) {
  try {
    const supabase = await createClient();
    
    // Verifica se o usuário que está a adicionar está logado (Segurança Zero Trust)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Não autorizado." };

    const { error } = await supabase
      .from("virtual_queue")
      .insert({
        barbershop_id: barbershopId,
        client_name: clientName,
        is_authenticated: false, // Marca como inserção manual para auditoria
        status: "waiting",
      });

    if (error) throw error;
    
    // Força a atualização de todas as rotas relevantes
    revalidatePath("/fila");
    revalidatePath("/pdv");
    revalidatePath("/b/[slug]", "page");
    
    return { success: true };
  } catch (err) {
    console.error("[MANUAL INSERT ERROR]", err);
    return { success: false, error: "Erro ao adicionar cliente." };
  }
}

// 4. Gerar um novo PIN de Segurança para o Totem
export async function generateNewPinAction(barbershopId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Não autorizado." };

    // Gera um PIN de 4 dígitos aleatório (1000 a 9999)
    const newPin = Math.floor(1000 + Math.random() * 9000).toString();

    const { error } = await supabase
      .from("barbershops")
      .update({ checkin_pin: newPin })
      .eq("id", barbershopId);

    if (error) throw error;
    
    return { success: true, newPin };
  } catch (err) {
    console.error("[PIN GENERATE ERROR]", err);
    return { success: false, error: "Erro ao gerar novo PIN." };
  }
}

// 5. Buscar o PIN atual da barbearia
export async function getBarbershopPinAction(barbershopId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("barbershops")
      .select("checkin_pin")
      .eq("id", barbershopId)
      .single();

    if (error || !data) return { pin: "0000" };
    return { pin: data.checkin_pin || "0000" };
  } catch {
    return { pin: "0000" };
  }
}

// 6. Salvar a avaliação centralizada (Estilo Uber)
export async function submitReviewAction(
  queueId: string, 
  barbershopId: string, 
  barberName: string | null, 
  barberRating: number, 
  barbershopRating: number, 
  comment: string
) {
  try {
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
        review_comment: comment.trim() || null,
        source_type: "queue", 
        source_id: queueId
      });

    if (reviewError) throw reviewError;

    // Atualiza a flag na fila
    const { error: queueError } = await supabase
      .from("virtual_queue")
      .update({ is_rated: true })
      .eq("id", queueId);

    if (queueError) throw queueError;
    
    revalidatePath("/b/[slug]", "page");
    return { success: true };
  } catch (err) {
    console.error("[REVIEW ERROR]", err);
    return { success: false, error: "Erro ao enviar avaliação." };
  }
}