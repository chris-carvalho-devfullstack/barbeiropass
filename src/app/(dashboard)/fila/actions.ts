// src/app/(dashboard)/fila/actions.ts
"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { EventLogRepository } from "@/infrastructure/database/supabase/EventLogRepository";
import { EventLogService } from "@/domain/shared/services/EventLogService";
import { TenantContext } from "@/domain/shared/TenantContext";

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
export async function updateQueueStatusAction(
  id: string, 
  status: string, 
  barberId?: string,
  serviceIds?: string[] // ATUALIZADO: Agora recebe um Array de IDs de serviços
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "Não autorizado."
    };
  }

  const { data: member, error: memberError } = await supabase
    .from("barbershop_members")
    .select("barbershop_id, role")
    .eq("profile_id", user.id)
    .single();

  if (memberError || !member) {
    return {
      error: "Vínculo com a barbearia não encontrado."
    };
  }
  
  // ==========================================
  // INTERCEPTADOR DA MÁQUINA DE ESTADOS
  // ==========================================
  // Se o botão do Front-end enviar o status antigo, convertemos para o novo fluxo.
  if (status === "finished") {
    status = "awaiting_payment";
  }

  if (status === "serving") {
    status = "in_progress";
  }

  if (status === "canceled") {
    status = "cancelled";
  }

  // ==========================================
  // BUSCA O ESTADO ATUAL DO TICKET
  // ==========================================
  const { data: queueItem, error: queueLookupError } = await supabase
    .from("virtual_queue")
    .select("id, barbershop_id, status")
    .eq("id", id)
    .eq("barbershop_id", member.barbershop_id)
    .single();

  if (queueLookupError || !queueItem) {
    return {
      error: "Atendimento não encontrado ou sem acesso."
    };
  }

  const currentStatus = queueItem.status;

  // ==========================================
  // VALIDAÇÃO DA MÁQUINA DE ESTADOS
  // ==========================================
  if (status === "in_progress" && currentStatus !== "waiting") {
    return {
      error: "Este cliente não está mais aguardando na fila."
    };
  }

  if (status === "cancelled" && currentStatus !== "waiting") {
    return {
      error: "Este atendimento já foi iniciado e não pode ser removido da fila."
    };
  }

  if (
    status === "awaiting_payment" &&
    currentStatus !== "in_progress" &&
    currentStatus !== "in_chair"
  ) {
    return {
      error: "O atendimento precisa estar iniciado antes de ser finalizado."
    };
  }

  type QueueUpdatePayload = {
    status: string;
    barber_id?: string | null;
    barber_name?: string | null;
    chair_number?: string | null;
    service_ids?: string[] | null; // ATUALIZADO: Tipagem para suportar o array
    cancellation_source?: "customer" | "barbershop" | "system" | null;
  };

  const updateData: QueueUpdatePayload = { status };

  // ATUALIZADO: Se o barbeiro indicou serviços ao finalizar, nós salvamos na fila
  if (serviceIds && serviceIds.length > 0) {
    updateData.service_ids = serviceIds;
  }

  if (status === "serving" || status === "in_progress") {
    let finalBarberId = barberId;
    let staffRecord = null;
    
    if (!finalBarberId) {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        const { data: staff } = await supabase
          .from("staff")
          .select(`id, full_name, work_stations ( name )`)
          .eq("profile_id", currentUser.id)
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
    updateData.cancellation_source = null;
    
    // RESOLUÇÃO DO ERRO 'ANY': Tipagem segura para a resposta dinâmica do Supabase
    type WorkStationData = { name?: string } | { name?: string }[] | null;
    const workStations = staffRecord.work_stations as WorkStationData;

    const chairName = Array.isArray(workStations) 
      ? workStations[0]?.name 
      : workStations?.name;

    updateData.chair_number = chairName || "Cadeira Principal";
  }

  if (status === "cancelled") {
    updateData.cancellation_source = "barbershop";
  }

  // ATUALIZADO: Libera a cadeira do barbeiro quando vai pro Caixa (Aguardando Pagamento), Concluído ou Cancelado
  if (status === "awaiting_payment" || status === "completed" || status === "cancelled") {
    updateData.chair_number = null; 
  }

  const { data: updatedQueue, error } = await supabase
    .from("virtual_queue")
    .update(updateData)
    .eq("id", id)
    .eq("barbershop_id", member.barbershop_id)
    .eq("status", currentStatus)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Erro ao atualizar fila:", error);
    return { error: "Erro ao atualizar status." };
  }

  if (!updatedQueue) {
    return {
      error: "O atendimento foi alterado por outro usuário. Atualize a fila e tente novamente."
    };
  }

  if (status === "cancelled") {
    const context: TenantContext = {
      tenantId: member.barbershop_id,
      userId: user.id,
      role: member.role as TenantContext["role"],
    };

    try {
      const eventService = new EventLogService(new EventLogRepository(supabase));

      await eventService.logEvent(context, {
        entityType: "QUEUE",
        entityId: id,
        eventType: "ADMIN_ACTION",
        performedBy: user.id,
        payload: {
          action: "QUEUE_REMOVED",
          source: "BARBERSHOP",
          reason: "REMOVED_BEFORE_START"
        },
      });
    } catch (eventError) {
      console.error("[QUEUE_REMOVE_AUDIT]", eventError);
      throw eventError;
    }
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