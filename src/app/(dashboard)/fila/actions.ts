// src/app/(dashboard)/fila/actions.ts
"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// 1. Entrar na Fila (Ação Legada/Interna - Totem Público)
export async function joinQueueAction(data: { 
  barbershop_id: string; 
  client_name: string; 
  client_id?: string | null;
  barber_id?: string | null;
}) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("virtual_queue")
    .insert({
      barbershop_id: data.barbershop_id,
      client_name: data.client_name,
      client_id: data.client_id || null,
      barber_id: data.barber_id || null,
      status: 'waiting'
    });

  if (error) {
    console.error("Erro ao entrar na fila:", error.message);
    return { error: "Erro ao entrar na fila." };
  }

  revalidatePath("/fila");
  revalidatePath("/pdv");
  revalidatePath("/b/[slug]", "page");
  
  return { success: true };
}

// 2. Atualizar Status (Para uso interno da Barbearia - ZERO TRUST)
export async function updateQueueStatusAction(id: string, status: string, barberId?: string) {
  const supabase = await createClient();
  
  // ==========================================
  // INTERCEPTADOR DA MÁQUINA DE ESTADOS
  // ==========================================
  // Se o botão do Front-end enviar o status antigo, convertemos para o novo fluxo.
  if (status === "finished") {
    status = "awaiting_payment";
  }

  type QueueUpdatePayload = {
    status: string;
    barber_id?: string | null;
    barber_name?: string | null;
    chair_number?: string | null;
  };

  const updateData: QueueUpdatePayload = { status };

  if (status === "serving" || status === "in_progress") {
    let finalBarberId = barberId;
    let staffRecord = null;
    
    if (!finalBarberId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: staff } = await supabase
          .from("staff")
          .select(`id, full_name, work_stations ( name )`)
          .eq("profile_id", user.id)
          .maybeSingle();
          
        if (staff) {
          finalBarberId = staff.id;
          staffRecord = staff;
        }
      }
    } else {
      const { data: staff } = await supabase
        .from("staff")
        .select(`full_name, work_stations ( name )`)
        .eq("id", finalBarberId)
        .single();
        
      if (staff) {
        staffRecord = staff;
      }
    }

    if (!finalBarberId || !staffRecord) {
      return { 
        error: "Para iniciar o atendimento, selecione um profissional responsável ou vincule seu perfil a uma cadeira." 
      };
    }

    updateData.barber_id = finalBarberId;
    updateData.barber_name = staffRecord.full_name;
    
    // RESOLUÇÃO DO ERRO 'ANY': Tipagem segura para a resposta dinâmica do Supabase
    type WorkStationData = { name?: string } | { name?: string }[] | null;
    const workStations = staffRecord.work_stations as WorkStationData;

    const chairName = Array.isArray(workStations) 
      ? workStations[0]?.name 
      : workStations?.name;

    updateData.chair_number = chairName || "Cadeira Principal";
  }

  // ATUALIZADO: Libera a cadeira do barbeiro quando vai pro Caixa (Aguardando Pagamento), Concluído ou Cancelado
  if (status === "awaiting_payment" || status === "completed" || status === "canceled") {
    updateData.chair_number = null; 
  }

  const { error } = await supabase
    .from("virtual_queue")
    .update(updateData)
    .eq("id", id);

  if (error) {
    console.error("Erro ao atualizar fila:", error);
    return { error: "Erro ao atualizar status." };
  }

  revalidatePath("/fila");
  revalidatePath("/pdv");
  
  return { success: true };
}

// =========================================================================
// NOVAS AÇÕES DA TORRE DE COMANDO (Dashboard)
// =========================================================================

// 3. Inserir cliente manualmente na fila (O "Sem Telemóvel")
export async function addManualClientAction(barbershopId: string, clientName: string, barberId?: string | null) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Não autorizado." };

    const { error } = await supabase
      .from("virtual_queue")
      .insert({
        barbershop_id: barbershopId,
        client_name: clientName,
        barber_id: barberId || null,
        is_authenticated: false, 
        status: "waiting",
      });

    if (error) throw error;
    
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