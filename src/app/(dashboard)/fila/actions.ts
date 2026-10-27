// src/app/(dashboard)/fila/actions.ts

"use server";



import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

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

      barber_id: null,
      preferred_barber_id: data.barber_id || null,

      status: 'waiting'

    });



  if (error) {

    console.error("Erro ao entrar na fila:", error.message);

    return { error: "Erro ao entrar na fila." };

  }



  revalidatePath("/fila");
  revalidatePath("/profissional/fila");
  revalidatePath("/profissional");
  revalidatePath("/pdv");

  revalidatePath("/b/[slug]", "page");



  return { success: true };

}



// Recupera somente os nomes de profissionais vinculados à barbearia do usuário.
// Usa a sessão para autorização e o cliente administrativo apenas para contornar a RLS
// que impede um barbeiro de consultar o nome dos demais profissionais da própria equipe.
export async function getQueueStaffNamesAction(barbershopId: string, staffIds: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Não autorizado." };
  }

  const { data: member, error: memberError } = await supabase
    .from("barbershop_members")
    .select("barbershop_id, role")
    .eq("profile_id", user.id)
    .eq("barbershop_id", barbershopId)
    .maybeSingle();

  if (memberError || !member || !["owner", "manager", "barber", "receptionist"].includes(member.role)) {
    return { error: "Você não tem acesso aos profissionais desta barbearia." };
  }

  const safeStaffIds = Array.from(new Set(
    (Array.isArray(staffIds) ? staffIds : [])
      .filter((staffId): staffId is string => typeof staffId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(staffId))
  )).slice(0, 100);

  if (safeStaffIds.length === 0) {
    return { staffNames: {} as Record<string, string> };
  }

  const admin = createAdminClient();
  const { data: staffRecords, error: staffRecordsError } = await admin
    .from("staff")
    .select("id, full_name")
    .eq("barbershop_id", member.barbershop_id)
    .in("id", safeStaffIds);

  if (staffRecordsError || !staffRecords) {
    console.error("[QUEUE_STAFF_NAMES_LOOKUP_ERROR]", staffRecordsError);
    return { error: "Não foi possível carregar os nomes dos profissionais." };
  }

  const staffNames = Object.fromEntries(
    staffRecords.map((staffRecord) => [staffRecord.id, staffRecord.full_name])
  ) as Record<string, string>;

  return { staffNames };
}


// 2. Atualizar Status (Para uso interno da Barbearia - ZERO TRUST)

export async function updateQueueStatusAction(

  id: string, 

  status: string, 

  barberId?: string,
  serviceIds?: string[],
  confirmations?: {
    clientAcceptedPreferenceChange?: boolean;
    outOfOrderConfirmed?: boolean;
  }
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



  if (!["owner", "manager", "barber", "receptionist"].includes(member.role)) {
    return { error: "Seu perfil não tem permissão para operar a fila." };
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

    .select("id, barbershop_id, status, joined_at, preferred_barber_id, barber_id")

    .eq("id", id)

    .eq("barbershop_id", member.barbershop_id)

    .single();



  if (queueLookupError || !queueItem) {

    return {

      error: "Atendimento não encontrado ou sem acesso."

    };

  }



  const currentStatus = queueItem.status;
  // Registros legados guardavam a preferência em barber_id enquanto aguardavam.
  const effectivePreferredBarberId = queueItem.preferred_barber_id ??
    (currentStatus === "waiting" ? queueItem.barber_id : null);



  // ==========================================

  // VALIDAÇÃO DA MÁQUINA DE ESTADOS

  // ==========================================

  if (!["in_progress", "awaiting_payment", "cancelled"].includes(status)) {
    return { error: "Transição de fila inválida." };
  }

  if (member.role === "barber" && status === "cancelled") {
    return { error: "O profissional não pode remover clientes da fila." };
  }

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

  // Um barbeiro só pode finalizar o ticket que está atribuído ao seu próprio staff.id.
  if (member.role === "barber" && status === "awaiting_payment") {
    const { data: ownStaff, error: ownStaffError } = await supabase
      .from("staff")
      .select("id")
      .eq("profile_id", user.id)
      .eq("barbershop_id", member.barbershop_id)
      .eq("role", "barber")
      .maybeSingle();

    if (ownStaffError || !ownStaff || queueItem.barber_id !== ownStaff.id) {
      return { error: "Você só pode finalizar um atendimento que esteja atribuído a você." };
    }
  }


  type QueueUpdatePayload = {

    status: string;

    started_at?: string | null;

    preferred_barber_id?: string | null;

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



  let queueStartAuditDetails: {
    preferredBarberId: string | null;
    assignedBarberId: string;
    clientAcceptedPreferenceChange: boolean;
    outOfOrderConfirmed: boolean;
    earlierWaitingCount: number;
  } | null = null;

  if (status === "serving" || status === "in_progress") {
    type QueueStaffRecord = {
      id: string;
      full_name: string;
      work_stations: { name?: string } | { name?: string }[] | null;
    };

    let finalBarberId: string | null = null;
    let staffRecord: QueueStaffRecord | null = null;

    // A conta de barbeiro só pode iniciar atendimentos usando o próprio registro staff.
    if (member.role === "barber") {
      const { data: ownStaff, error: ownStaffError } = await supabase
        .from("staff")
        .select("id, full_name, work_stations ( name )")
        .eq("profile_id", user.id)
        .eq("barbershop_id", member.barbershop_id)
        .eq("role", "barber")
        .eq("is_active", true)
        .maybeSingle();

      if (ownStaffError || !ownStaff) {
        return { error: "Seu perfil profissional ativo não foi encontrado nesta barbearia." };
      }

      if (barberId && barberId !== ownStaff.id) {
        return { error: "Um profissional só pode iniciar atendimentos em seu próprio nome." };
      }

      finalBarberId = ownStaff.id;
      staffRecord = ownStaff as unknown as QueueStaffRecord;
    } else if (barberId) {
      const { data: selectedStaff, error: selectedStaffError } = await supabase
        .from("staff")
        .select("id, full_name, work_stations ( name )")
        .eq("id", barberId)
        .eq("barbershop_id", member.barbershop_id)
        .eq("is_active", true)
        .maybeSingle();

      if (selectedStaffError || !selectedStaff) {
        return { error: "O profissional selecionado não pertence a esta barbearia ou está inativo." };
      }

      finalBarberId = selectedStaff.id;
      staffRecord = selectedStaff as unknown as QueueStaffRecord;
    } else {
      const { data: ownStaff, error: ownStaffError } = await supabase
        .from("staff")
        .select("id, full_name, work_stations ( name )")
        .eq("profile_id", user.id)
        .eq("barbershop_id", member.barbershop_id)
        .eq("is_active", true)
        .maybeSingle();

      if (ownStaffError || !ownStaff) {
        return { error: "Para iniciar o atendimento, vincule seu perfil a um profissional ativo ou selecione um responsável autorizado." };
      }

      finalBarberId = ownStaff.id;
      staffRecord = ownStaff as unknown as QueueStaffRecord;
    }

    if (!finalBarberId || !staffRecord) {
      return { error: "Não foi possível determinar o profissional responsável pelo atendimento." };
    }

    // Bloqueia início de um segundo atendimento para o mesmo profissional.
    // A validação da interface é apenas informativa; esta checagem é a regra de servidor.
    const { data: activeTicket, error: activeTicketError } = await supabase
      .from("virtual_queue")
      .select("id, client_name")
      .eq("barbershop_id", member.barbershop_id)
      .eq("barber_id", finalBarberId)
      .in("status", ["in_progress", "in_chair"])
      .neq("id", id)
      .limit(1)
      .maybeSingle();

    if (activeTicketError) {
      console.error("[QUEUE_ACTIVE_TICKET_CHECK_ERROR]", activeTicketError);
      return { error: "Não foi possível verificar se o profissional já está atendendo. Atualize e tente novamente." };
    }

    if (activeTicket) {
      return {
        error: `${staffRecord.full_name} já está atendendo ${activeTicket.client_name}. Finalize esse atendimento antes de iniciar outro.`,
      };
    }

    // Revalida a ordem atual no servidor imediatamente antes de iniciar.
    const { data: waitingItems, error: waitingItemsError } = await supabase
      .from("virtual_queue")
      .select("id, joined_at")
      .eq("barbershop_id", member.barbershop_id)
      .eq("status", "waiting")
      .order("joined_at", { ascending: true })
      .order("id", { ascending: true });

    if (waitingItemsError || !waitingItems) {
      console.error("[QUEUE_START_ORDER_CHECK_ERROR]", waitingItemsError);
      return { error: "Não foi possível verificar a ordem atual da fila. Atualize e tente novamente." };
    }

    const targetQueueIndex = waitingItems.findIndex((item) => item.id === id);
    if (targetQueueIndex < 0) {
      return { error: "Este cliente não está mais aguardando na fila. Atualize a lista." };
    }

    const requiresOutOfOrderConfirmation = targetQueueIndex > 0;
    const requiresPreferenceChangeConfirmation = Boolean(
      effectivePreferredBarberId && effectivePreferredBarberId !== finalBarberId
    );
    const clientAcceptedPreferenceChange = confirmations?.clientAcceptedPreferenceChange === true;
    const outOfOrderConfirmed = confirmations?.outOfOrderConfirmed === true;

    if (
      (requiresPreferenceChangeConfirmation && !clientAcceptedPreferenceChange) ||
      (requiresOutOfOrderConfirmation && !outOfOrderConfirmed)
    ) {
      return {
        success: false,
        requiresConfirmation: true,
        confirmationRequirements: {
          preferenceChange: requiresPreferenceChangeConfirmation,
          outOfOrder: requiresOutOfOrderConfirmation,
          earlierWaitingCount: targetQueueIndex,
        },
        error: "Confirme as condições especiais antes de iniciar este atendimento.",
      };
    }

    // Preserva a preferência dos tickets legados antes de atribuir o profissional real.
    if (!queueItem.preferred_barber_id && effectivePreferredBarberId) {
      updateData.preferred_barber_id = effectivePreferredBarberId;
    }

    updateData.barber_id = finalBarberId;
    updateData.barber_name = staffRecord.full_name;
    updateData.started_at = new Date().toISOString();
    updateData.cancellation_source = null;

    type WorkStationData = { name?: string } | { name?: string }[] | null;
    const workStations = staffRecord.work_stations as WorkStationData;
    const chairName = Array.isArray(workStations) ? workStations[0]?.name : workStations?.name;
    updateData.chair_number = chairName || "Cadeira Principal";

    queueStartAuditDetails = {
      preferredBarberId: effectivePreferredBarberId || null,
      assignedBarberId: finalBarberId,
      clientAcceptedPreferenceChange,
      outOfOrderConfirmed,
      earlierWaitingCount: targetQueueIndex,
    };
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

    if (status === "in_progress" && error.code === "23505") {
      return { error: "Este profissional já possui um atendimento em andamento. Finalize-o antes de iniciar outro." };
    }

    return { error: "Erro ao atualizar status." };

  }



  if (!updatedQueue) {

    return {

      error: "O atendimento foi alterado por outro usuário. Atualize a fila e tente novamente."

    };

  }



  if (status === "in_progress" && queueStartAuditDetails) {
    const hasConfirmedException =
      queueStartAuditDetails.clientAcceptedPreferenceChange || queueStartAuditDetails.outOfOrderConfirmed;

    if (hasConfirmedException) {
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
            action: "QUEUE_SERVICE_STARTED_WITH_EXCEPTION",
            preferredBarberId: queueStartAuditDetails.preferredBarberId,
            assignedBarberId: queueStartAuditDetails.assignedBarberId,
            clientAcceptedPreferenceChange: queueStartAuditDetails.clientAcceptedPreferenceChange,
            outOfOrderConfirmed: queueStartAuditDetails.outOfOrderConfirmed,
            earlierWaitingCount: queueStartAuditDetails.earlierWaitingCount,
          },
        });
      } catch (eventError) {
        console.error("[QUEUE_START_EXCEPTION_AUDIT]", eventError);
      }
    }
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
  revalidatePath("/profissional/fila");
  revalidatePath("/profissional");
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

    const { data: member, error: memberError } = await supabase
      .from("barbershop_members")
      .select("role")
      .eq("profile_id", user.id)
      .eq("barbershop_id", barbershopId)
      .maybeSingle();

    if (memberError || !member || !["owner", "manager", "receptionist"].includes(member.role)) {
      return { success: false, error: "Você não tem permissão para inserir clientes manualmente nesta fila." };
    }

    if (barberId) {
      const { data: preferredStaff, error: preferredStaffError } = await supabase
        .from("staff")
        .select("id")
        .eq("id", barberId)
        .eq("barbershop_id", barbershopId)
        .eq("is_active", true)
        .maybeSingle();

      if (preferredStaffError || !preferredStaff) {
        return { success: false, error: "O profissional preferido não pertence a esta barbearia ou está inativo." };
      }
    }

    const { error } = await supabase

      .from("virtual_queue")

      .insert({

        barbershop_id: barbershopId,

        client_name: clientName,

        barber_id: null,

        preferred_barber_id: barberId || null,

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

    const { data: member, error: memberError } = await supabase
      .from("barbershop_members")
      .select("role")
      .eq("profile_id", user.id)
      .eq("barbershop_id", barbershopId)
      .maybeSingle();

    if (memberError || !member || !["owner", "manager"].includes(member.role)) {
      return { success: false, error: "Apenas proprietários e gerentes podem alterar o PIN da barbearia." };
    }

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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { pin: "0000" };

    const { data: member, error: memberError } = await supabase
      .from("barbershop_members")
      .select("role")
      .eq("profile_id", user.id)
      .eq("barbershop_id", barbershopId)
      .maybeSingle();

    if (memberError || !member || !["owner", "manager"].includes(member.role)) {
      return { pin: "0000" };
    }

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
