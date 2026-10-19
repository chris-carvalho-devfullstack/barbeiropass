import "server-only";

import { createAdminClient } from "@/utils/supabase/admin";

import {
  buildQueueAvailability,
  type QueueAvailabilityBarberSource,
  type QueueBusinessHourInput,
  type QueueTimeBlockInput,
  type QueueWorkingHourInput,
} from "@/domain/queue/services/QueueAvailabilityService";

import {
  estimateQueueWaitTimes,
  type QueueServiceMode,
  type QueueTicketInput,
  type QueueWaitTimeEstimatorResult,
} from "@/domain/queue/services/QueueWaitTimeEstimator";

const DEFAULT_QUEUE_DURATION_MINUTES = 20;
const MAX_QUEUE_DURATION_MINUTES = 480;
const DEFAULT_TIME_ZONE = "America/Sao_Paulo";
const PUBLIC_PREVIEW_TICKET_ID = "__public_queue_preview__";

type QueueAcceptancePolicy =
  | "accept_until_closing"
  | "restrict_by_capacity";

const DEFAULT_QUEUE_ACCEPTANCE_POLICY: QueueAcceptancePolicy =
  "restrict_by_capacity";

const ACTIVE_QUEUE_STATUSES = [
  "waiting",
  "in_progress",
  "in_chair",
] as const;

interface StaffRow {
  id: string;
  full_name: string | null;
  is_active: boolean | null;
  accepting_queue: boolean | null;
}

interface WorkingHourRow {
  staff_id: string;
  day_of_week: number;
  is_active: boolean;
  start_time: string;
  end_time: string;
  service_mode: string;
}

interface TimeBlockRow {
  staff_id: string;
  block_date: string | null;
  start_time: string;
  end_time: string;
  type: string;
}

interface QueueTicketRow {
  id: string;
  status: string;
  joined_at: string | null;
  barber_id: string | null;
  preferred_barber_id: string | null;
  estimated_duration_minutes: number | null;
  started_at: string | null;
}

interface BarbershopSettingsRow {
  accepts_walk_in: boolean | null;
  default_queue_duration_minutes: number | null;
  queue_acceptance_policy: string | null;
}

interface BusinessHoursRow {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

export interface SupabaseQueueWaitTimeOptions {
  barbershopId: string;
  now?: Date | string;
  timeZone?: string;
  daysAhead?: number;

  /**
   * Simula uma nova entrada ao final da fila sem gravá-la no banco.
   * A rota pública pode usar essa previsão antes de o visitante
   * concluir o check-in presencial.
   */
  includePublicPreview?: boolean;
}

export type PublicQueueAvailabilityStatusCode =
  | "available"
  | "barbershop_closed"
  | "professionals_off_shift"
  | "queue_unavailable"
  | "no_availability";

export interface PublicQueueAvailabilityStatus {
  status: PublicQueueAvailabilityStatusCode;
  businessHoursConfigured: boolean;
  businessOpenNow: boolean | null;
  nextBusinessOpeningAt: string | null;
  businessClosesAt: string | null;
  professionalsAvailableNow: number;
  nextAvailableAt: string | null;
}

export interface SupabaseQueueWaitTimeResult {
  barbershopId: string;
  calculatedAt: string;
  timeZone: string;

  barbershopAcceptsQueue: boolean;
  defaultQueueDurationMinutes: number;

  waitingCount: number;
  activeTicketCount: number;
  eligibleBarberCount: number;

  /** Estado legível de disponibilidade para a interface pública. */
  publicAvailability: PublicQueueAvailabilityStatus;

  estimate: QueueWaitTimeEstimatorResult;
}

function normalizeServiceMode(value: string): QueueServiceMode {
  if (value === "queue" || value === "hybrid") {
    return value;
  }

  return "appointment";
}

function normalizeDefaultDuration(
  value: number | null | undefined
): number {
  const duration = Number(value);

  if (
    Number.isInteger(duration) &&
    duration >= 1 &&
    duration <= MAX_QUEUE_DURATION_MINUTES
  ) {
    return duration;
  }

  return DEFAULT_QUEUE_DURATION_MINUTES;
}

function normalizeTicketDuration(
  value: number | null,
  defaultDuration: number
): number {
  const duration = Number(value);

  if (
    Number.isInteger(duration) &&
    duration >= 1 &&
    duration <= MAX_QUEUE_DURATION_MINUTES
  ) {
    return duration;
  }

  return defaultDuration;
}

function normalizeQueueAcceptancePolicy(
  value: string | null | undefined
): QueueAcceptancePolicy {
  if (value === "accept_until_closing") {
    return "accept_until_closing";
  }

  if (value === "restrict_by_capacity") {
    return "restrict_by_capacity";
  }

  // Em caso de valor ausente ou desconhecido, adotamos a política
  // conservadora para não permitir entradas além da capacidade atual.
  return DEFAULT_QUEUE_ACCEPTANCE_POLICY;
}

function getLocalDateKeyInTimeZone(
  value: Date | string,
  timeZone: string
): string {
  const date = value instanceof Date ? value : new Date(value);

  if (!Number.isFinite(date.getTime())) {
    throw new Error(
      "[SupabaseQueueWaitTimeService] Data inválida ao comparar o dia local."
    );
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = new Map(parts.map((part) => [part.type, part.value]));
  const year = values.get("year");
  const month = values.get("month");
  const day = values.get("day");

  if (!year || !month || !day) {
    throw new Error(
      "[SupabaseQueueWaitTimeService] Não foi possível determinar o dia local."
    );
  }

  return `${year}-${month}-${day}`;
}

/**
 * Carrega os dados reais da fila e calcula as previsões.
 *
 * Este módulo é exclusivo do servidor. O resultado contém IDs
 * internos dos tickets e não deve ser serializado integralmente
 * para visitantes anônimos.
 */
export async function calculateSupabaseQueueWaitTimes(
  options: SupabaseQueueWaitTimeOptions
): Promise<SupabaseQueueWaitTimeResult> {
  const {
    barbershopId,
    now = new Date(),
    timeZone = DEFAULT_TIME_ZONE,
    daysAhead = 14,
    includePublicPreview = false,
  } = options;

  if (!barbershopId.trim()) {
    throw new Error(
      "[SupabaseQueueWaitTimeService] barbershopId é obrigatório."
    );
  }

  const nowDate = now instanceof Date ? now : new Date(now);

  if (!Number.isFinite(nowDate.getTime())) {
    throw new Error(
      "[SupabaseQueueWaitTimeService] Instante de referência inválido."
    );
  }

  const admin = createAdminClient();

  // 1. Busca os profissionais da barbearia.
  //
  // Não filtramos is_active aqui: um profissional desativado pode
  // ainda ter um atendimento em andamento que ocupa sua linha do tempo.
  const { data: staffData, error: staffError } = await admin
    .from("staff")
    .select("id, full_name, is_active, accepting_queue")
    .eq("barbershop_id", barbershopId)
    .eq("role", "barber");

  if (staffError) {
    console.error(
      "[SupabaseQueueWaitTimeService] Erro ao buscar profissionais:",
      staffError.message
    );

    throw new Error(
      "Não foi possível consultar os profissionais da barbearia."
    );
  }

  const staffRows = (staffData ?? []) as unknown as StaffRow[];
  const staffIds = staffRows.map((staff) => staff.id);

  // 2. Consulta configurações, horários gerais e tickets em paralelo.
  const [settingsResult, ticketsResult, businessHoursResult] = await Promise.all([
    admin
      .from("barbershop_settings")
      .select(
        "accepts_walk_in, default_queue_duration_minutes, queue_acceptance_policy"
      )
      .eq("barbershop_id", barbershopId)
      .maybeSingle(),

    admin
      .from("virtual_queue")
      .select(
        [
          "id",
          "status",
          "joined_at",
          "barber_id",
          "preferred_barber_id",
          "estimated_duration_minutes",
          "started_at",
        ].join(", ")
      )
      .eq("barbershop_id", barbershopId)
      .in("status", [...ACTIVE_QUEUE_STATUSES])
      .order("joined_at", { ascending: true }),

    admin
      .from("barbershop_business_hours")
      .select("day_of_week, open_time, close_time, is_closed")
      .eq("barbershop_id", barbershopId)
      .order("day_of_week", { ascending: true }),
  ]);

  if (settingsResult.error) {
    console.error(
      "[SupabaseQueueWaitTimeService] Erro nas configurações:",
      settingsResult.error.message
    );

    throw new Error(
      "Não foi possível consultar as configurações da barbearia."
    );
  }

  if (ticketsResult.error) {
    console.error(
      "[SupabaseQueueWaitTimeService] Erro ao buscar tickets:",
      ticketsResult.error.message
    );

    throw new Error(
      "Não foi possível consultar os tickets da fila."
    );
  }

  if (businessHoursResult.error) {
    console.error(
      "[SupabaseQueueWaitTimeService] Erro ao buscar horários da barbearia:",
      businessHoursResult.error.message
    );

    throw new Error(
      "Não foi possível consultar os horários de funcionamento da barbearia."
    );
  }

  const settings = settingsResult.data as
    | BarbershopSettingsRow
    | null;

  const ticketsData = (
    ticketsResult.data ?? []
  ) as unknown as QueueTicketRow[];

  const businessHoursRows = (
    businessHoursResult.data ?? []
  ) as unknown as BusinessHoursRow[];

  const businessHours: QueueBusinessHourInput[] = businessHoursRows.map(
    (row) => ({
      day_of_week: row.day_of_week,
      open_time: row.open_time,
      close_time: row.close_time,
      is_closed: row.is_closed,
    })
  );

  const defaultQueueDurationMinutes = normalizeDefaultDuration(
    settings?.default_queue_duration_minutes
  );

  // Mantém compatibilidade com o comportamento existente:
  // se a configuração global não existir, assume true.
  const barbershopAcceptsQueue =
    settings?.accepts_walk_in ?? true;

  const queueAcceptancePolicy = normalizeQueueAcceptancePolicy(
    settings?.queue_acceptance_policy
  );
  const allowQueueToContinueAfterClosing =
    queueAcceptancePolicy === "accept_until_closing";

  // 3. Busca expediente semanal e bloqueios.
  let workingHoursRows: WorkingHourRow[] = [];
  let timeBlockRows: TimeBlockRow[] = [];

  if (staffIds.length > 0) {
    const [workingHoursResult, timeBlocksResult] = await Promise.all([
      admin
        .from("staff_working_hours")
        .select(
          [
            "staff_id",
            "day_of_week",
            "is_active",
            "start_time",
            "end_time",
            "service_mode",
          ].join(", ")
        )
        .in("staff_id", staffIds),

      admin
        .from("staff_time_blocks")
        .select(
          [
            "staff_id",
            "block_date",
            "start_time",
            "end_time",
            "type",
          ].join(", ")
        )
        .in("staff_id", staffIds),
    ]);

    if (workingHoursResult.error) {
      console.error(
        "[SupabaseQueueWaitTimeService] Erro ao buscar expedientes:",
        workingHoursResult.error.message
      );

      throw new Error(
        "Não foi possível consultar os expedientes dos profissionais."
      );
    }

    if (timeBlocksResult.error) {
      console.error(
        "[SupabaseQueueWaitTimeService] Erro ao buscar bloqueios:",
        timeBlocksResult.error.message
      );

      throw new Error(
        "Não foi possível consultar as pausas dos profissionais."
      );
    }

    workingHoursRows = (
      workingHoursResult.data ?? []
    ) as unknown as WorkingHourRow[];

    timeBlockRows = (
      timeBlocksResult.data ?? []
    ) as unknown as TimeBlockRow[];
  }

  // 4. Agrupa os expedientes por profissional.
  const workingHoursByStaff = new Map<
    string,
    QueueWorkingHourInput[]
  >();

  for (const row of workingHoursRows) {
    const rows = workingHoursByStaff.get(row.staff_id) ?? [];

    rows.push({
      day_of_week: row.day_of_week,
      is_active: row.is_active,
      start_time: row.start_time,
      end_time: row.end_time,
      service_mode: normalizeServiceMode(row.service_mode),
    });

    workingHoursByStaff.set(row.staff_id, rows);
  }

  // 5. Agrupa as pausas por profissional.
  const timeBlocksByStaff = new Map<
    string,
    QueueTimeBlockInput[]
  >();

  for (const row of timeBlockRows) {
    const rows = timeBlocksByStaff.get(row.staff_id) ?? [];

    rows.push({
      block_date: row.block_date,
      start_time: row.start_time,
      end_time: row.end_time,
      type: row.type,
    });

    timeBlocksByStaff.set(row.staff_id, rows);
  }

  // 6. Monta a entrada do QueueAvailabilityService.
  const barberSources: QueueAvailabilityBarberSource[] =
    staffRows.map((staff) => ({
      id: staff.id,
      name: staff.full_name?.trim() || "Profissional",

      is_active: staff.is_active ?? false,
      accepting_queue: staff.accepting_queue ?? true,

      working_hours: workingHoursByStaff.get(staff.id) ?? [],
      time_blocks: timeBlocksByStaff.get(staff.id) ?? [],
    }));

  const availability = buildQueueAvailability({
    now: nowDate,
    timeZone,
    daysAhead,
    barbershopAcceptsQueue,
    barbers: barberSources,
    minimumServiceDurationMinutes: defaultQueueDurationMinutes,
    allowQueueToContinueAfterClosing,
    // Só aplicamos a restrição geral se houver horários persistidos.
    // Isso mantém compatibilidade com barbearias ainda sem configuração.
    business_hours: businessHours.length > 0 ? businessHours : undefined,
  });

  // 7. Normaliza os tickets para o modelo do estimador.
  const queueTickets: QueueTicketInput[] = ticketsData.map((ticket) => {
    const isActive =
      ticket.status === "in_progress" ||
      ticket.status === "in_chair";

    /**
     * Compatibilidade com tickets anteriores à introdução de
     * preferred_barber_id:
     *
     * Nos tickets que ainda aguardam, barber_id pode guardar a
     * preferência antiga do cliente. Nos tickets ativos, barber_id
     * representa o profissional que está realizando o atendimento.
     */
    const preferredBarberId =
      ticket.preferred_barber_id ??
      (ticket.status === "waiting" ? ticket.barber_id : null);

    return {
      id: ticket.id,
      status: ticket.status,
      joinedAt: ticket.joined_at,

      barberId: isActive ? ticket.barber_id : null,
      preferredBarberId,

      estimatedDurationMinutes: normalizeTicketDuration(
        ticket.estimated_duration_minutes,
        defaultQueueDurationMinutes
      ),

      startedAt: isActive ? ticket.started_at : null,
    };
  });

  // 8. Executa o algoritmo. O ticket de preview é apenas uma
  // simulação em memória e nunca é persistido no Supabase.
  const estimate = estimateQueueWaitTimes({
    now: nowDate,
    barbershopAcceptsQueue,
    barbers: availability.barbers,
    tickets: queueTickets,
    allowQueueToContinueAfterClosing,

    previewTicket: includePublicPreview
      ? {
          id: PUBLIC_PREVIEW_TICKET_ID,
          status: "waiting",
          joinedAt: null,
          barberId: null,
          preferredBarberId: null,
          estimatedDurationMinutes: defaultQueueDurationMinutes,
          startedAt: null,
        }
      : null,
  });

  const waitingCount = ticketsData.filter(
    (ticket) => ticket.status === "waiting"
  ).length;

  const activeTicketCount = ticketsData.filter(
    (ticket) =>
      ticket.status === "in_progress" ||
      ticket.status === "in_chair"
  ).length;

  const eligibleBarberCount = estimate.barbers.filter(
    (barber) => barber.eligibleForNewClients
  ).length;

  const previewEstimate = includePublicPreview
    ? estimate.estimates.find(
        (item) => item.ticketId === PUBLIC_PREVIEW_TICKET_ID
      ) ?? null
    : null;

  const scheduleStatus = availability.scheduleStatus;
  let publicAvailabilityStatus: PublicQueueAvailabilityStatusCode;

  const previewStartsOnAnotherLocalDay = Boolean(
    previewEstimate?.estimatedStartAt &&
      getLocalDateKeyInTimeZone(previewEstimate.estimatedStartAt, timeZone) !==
        getLocalDateKeyInTimeZone(nowDate, timeZone)
  );

  // A situação da barbearia tem prioridade sobre o horário da equipe.
  // Na política restritiva, uma entrada pública só é aceita quando a
  // previsão consegue começar no mesmo dia, dentro da capacidade atual.
  if (
    scheduleStatus.businessHoursConfigured &&
    scheduleStatus.businessOpenNow === false
  ) {
    publicAvailabilityStatus = "barbershop_closed";
  } else if (!barbershopAcceptsQueue) {
    publicAvailabilityStatus = "queue_unavailable";
  } else if (
    includePublicPreview &&
    queueAcceptancePolicy === "restrict_by_capacity" &&
    (!previewEstimate?.estimatedStartAt || previewStartsOnAnotherLocalDay)
  ) {
    publicAvailabilityStatus = "no_availability";
  } else if (scheduleStatus.professionalsAvailableNow === 0) {
    publicAvailabilityStatus = previewEstimate?.estimatedStartAt
      ? "professionals_off_shift"
      : "no_availability";
  } else if (!previewEstimate?.estimatedStartAt && includePublicPreview) {
    publicAvailabilityStatus = "no_availability";
  } else {
    publicAvailabilityStatus = "available";
  }

  const publicAvailability: PublicQueueAvailabilityStatus = {
    status: publicAvailabilityStatus,
    businessHoursConfigured: scheduleStatus.businessHoursConfigured,
    businessOpenNow: scheduleStatus.businessOpenNow,
    nextBusinessOpeningAt: scheduleStatus.nextBusinessOpeningAt,
    businessClosesAt: scheduleStatus.businessClosesAt,
    professionalsAvailableNow: scheduleStatus.professionalsAvailableNow,
    nextAvailableAt: previewEstimate?.estimatedStartAt ?? null,
  };

  return {
    barbershopId,
    calculatedAt: estimate.calculatedAt,
    timeZone,

    barbershopAcceptsQueue,
    defaultQueueDurationMinutes,

    waitingCount,
    activeTicketCount,
    eligibleBarberCount,
    publicAvailability,

    estimate,
  };
}
