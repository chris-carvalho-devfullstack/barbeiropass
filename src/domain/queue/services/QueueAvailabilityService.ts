import type {
  QueueAvailabilityWindow,
  QueueBarberInput,
  QueueServiceMode,
} from "./QueueWaitTimeEstimator";

/**
 * Dados correspondentes a uma linha de staff_working_hours.
 */
export interface QueueWorkingHourInput {
  day_of_week: number;
  is_active: boolean;
  start_time: string;
  end_time: string;
  service_mode: QueueServiceMode | string;
}

/**
 * Horário geral de funcionamento da barbearia.
 * Corresponde a uma linha de barbershop_business_hours.
 */
export interface QueueBusinessHourInput {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

/**
 * Dados correspondentes a uma linha de staff_time_blocks.
 *
 * block_date:
 * - Uma data específica: aplica o bloqueio somente naquele dia.
 * - null: aplica o bloqueio diariamente, conforme a convenção atual.
 */
export interface QueueTimeBlockInput {
  block_date: string | null;
  start_time: string;
  end_time: string;
  type: "lunch" | "vacation" | "holiday" | "manual_block" | string;
}

/**
 * Dados de um profissional e seus horários.
 */
export interface QueueAvailabilityBarberSource {
  id: string;
  name: string;
  is_active: boolean;
  accepting_queue: boolean;
  working_hours: QueueWorkingHourInput[];
  time_blocks: QueueTimeBlockInput[];
}

export interface QueueAvailabilityServiceInput {
  now: Date | string;
  timeZone: string;
  barbershopAcceptsQueue: boolean;
  barbers: QueueAvailabilityBarberSource[];
  /** Duração mínima para aceitar um novo atendimento neste momento. */
  minimumServiceDurationMinutes?: number;
  /**
   * Quando true, permite que a sequência da fila continue após o fim
   * da última janela diária de disponibilidade. A aceitação de novos
   * clientes continua limitada à janela de expediente vigente.
   *
   * Por padrão, false mantém a regra restritiva atual: o atendimento
   * precisa caber integralmente na janela disponível.
   */
  allowQueueToContinueAfterClosing?: boolean;
  /**
   * Expediente geral do estabelecimento. Quando informado, a
   * disponibilidade individual de cada profissional será limitada
   * à interseção com estes horários. Um array vazio mantém o
   * comportamento legado, útil para estabelecimentos ainda sem
   * expediente geral cadastrado.
   */
  business_hours?: QueueBusinessHourInput[];
  daysAhead?: number;
}

export interface QueueAvailabilityScheduleStatus {
  /** Se false, a barbearia ainda não possui expediente geral salvo. */
  businessHoursConfigured: boolean;
  /** null quando não há expediente geral cadastrado. */
  businessOpenNow: boolean | null;
  /** Próxima abertura geral, quando a barbearia está fechada. */
  nextBusinessOpeningAt: string | null;
  /** Fechamento de hoje, quando a barbearia está aberta agora. */
  businessClosesAt: string | null;
  /** Profissionais com expediente compatível para iniciar o serviço agora. */
  professionalsAvailableNow: number;
}

export interface QueueAvailabilityServiceResult {
  calculatedAt: string;
  timeZone: string;
  horizonDays: number;
  barbershopAcceptsQueue: boolean;
  barbers: QueueBarberInput[];
  scheduleStatus: QueueAvailabilityScheduleStatus;
}

interface ClockTime {
  hour: number;
  minute: number;
  second: number;
}

interface LocalDateTimeParts extends ClockTime {
  year: number;
  month: number;
  day: number;
}

interface TimeInterval {
  startMs: number;
  endMs: number;
}

const DEFAULT_HORIZON_DAYS = 14;
const MAX_HORIZON_DAYS = 31;

const QUEUE_SERVICE_MODES = new Set<string>([
  "queue",
  "hybrid",
]);

function createTimeZoneFormatter(
  timeZone: string
): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    throw new Error(
      `[QueueAvailabilityService] Fuso horário inválido: "${timeZone}".`
    );
  }
}

function getLocalDateTimeParts(
  timestampMs: number,
  formatter: Intl.DateTimeFormat
): LocalDateTimeParts {
  const parts = formatter.formatToParts(new Date(timestampMs));
  const values = new Map(parts.map((part) => [part.type, part.value]));

  const result = {
    year: Number(values.get("year")),
    month: Number(values.get("month")),
    day: Number(values.get("day")),
    hour: Number(values.get("hour")),
    minute: Number(values.get("minute")),
    second: Number(values.get("second")),
  };

  if (
    !Number.isInteger(result.year) ||
    !Number.isInteger(result.month) ||
    !Number.isInteger(result.day) ||
    !Number.isInteger(result.hour) ||
    !Number.isInteger(result.minute) ||
    !Number.isInteger(result.second)
  ) {
    throw new Error(
      "[QueueAvailabilityService] Não foi possível interpretar a data local."
    );
  }

  return result;
}

/**
 * Converte data e hora civis no fuso da barbearia para UTC.
 * Rejeita horários locais inexistentes durante transições de horário de verão.
 */
function localDateTimeToUtcMs(
  dateKey: string,
  timeValue: string,
  formatter: Intl.DateTimeFormat,
  timeZone: string
): number {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);

  if (!dateMatch) {
    throw new Error(
      `[QueueAvailabilityService] Data inválida: "${dateKey}".`
    );
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const clock = parseClockTime(timeValue);

  const expectedUtcMs = Date.UTC(
    year,
    month - 1,
    day,
    clock.hour,
    clock.minute,
    clock.second
  );

  let candidateMs = expectedUtcMs;

  for (let iteration = 0; iteration < 5; iteration++) {
    const observed = getLocalDateTimeParts(candidateMs, formatter);

    const observedAsUtcMs = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second
    );

    const offsetMs = observedAsUtcMs - candidateMs;
    const nextCandidateMs = expectedUtcMs - offsetMs;

    if (nextCandidateMs === candidateMs) {
      break;
    }

    candidateMs = nextCandidateMs;
  }

  const result = getLocalDateTimeParts(candidateMs, formatter);

  const matchesRequestedLocalTime =
    result.year === year &&
    result.month === month &&
    result.day === day &&
    result.hour === clock.hour &&
    result.minute === clock.minute &&
    result.second === clock.second;

  if (!matchesRequestedLocalTime) {
    throw new Error(
      `[QueueAvailabilityService] O horário local "${dateKey} ${timeValue}" ` +
        `não pode ser convertido corretamente no fuso "${timeZone}".`
    );
  }

  return candidateMs;
}

function parseClockTime(value: string): ClockTime {
  const match =
    /^(\d{1,2}):([0-5]\d)(?::([0-5]\d)(?:\.\d+)?)?$/.exec(value.trim());

  if (!match) {
    throw new Error(
      `[QueueAvailabilityService] Horário inválido: "${value}".`
    );
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? "0");

  if (hour < 0 || hour > 23) {
    throw new Error(
      `[QueueAvailabilityService] Hora fora do intervalo permitido: "${value}".`
    );
  }

  return { hour, minute, second };
}

function getLocalDateKey(
  timestampMs: number,
  formatter: Intl.DateTimeFormat
): string {
  const parts = getLocalDateTimeParts(timestampMs, formatter);

  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
}

function getDayOfWeek(dateKey: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);

  if (!match) {
    throw new Error(
      `[QueueAvailabilityService] Data inválida: "${dateKey}".`
    );
  }

  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  ).getUTCDay();
}

function addCalendarDays(
  dateKey: string,
  numberOfDays: number
): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);

  if (!match) {
    throw new Error(
      `[QueueAvailabilityService] Data inválida: "${dateKey}".`
    );
  }

  const date = new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]) + numberOfDays
    )
  );

  return [
    String(date.getUTCFullYear()).padStart(4, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function supportsQueue(serviceMode: string): boolean {
  return QUEUE_SERVICE_MODES.has(serviceMode);
}

function blockAppliesOnDate(
  block: QueueTimeBlockInput,
  dateKey: string
): boolean {
  if (block.block_date == null || block.block_date.trim() === "") {
    return true;
  }

  return block.block_date.slice(0, 10) === dateKey;
}

function subtractInterval(
  intervals: TimeInterval[],
  blocked: TimeInterval
): TimeInterval[] {
  const result: TimeInterval[] = [];

  for (const interval of intervals) {
    const hasNoIntersection =
      blocked.endMs <= interval.startMs ||
      blocked.startMs >= interval.endMs;

    if (hasNoIntersection) {
      result.push(interval);
      continue;
    }

    if (blocked.startMs > interval.startMs) {
      result.push({
        startMs: interval.startMs,
        endMs: Math.min(blocked.startMs, interval.endMs),
      });
    }

    if (blocked.endMs < interval.endMs) {
      result.push({
        startMs: Math.max(blocked.endMs, interval.startMs),
        endMs: interval.endMs,
      });
    }
  }

  return result.filter(
    (interval) => interval.endMs > interval.startMs
  );
}

function calculateBusinessScheduleStatus(
  nowMs: number,
  daysAhead: number,
  formatter: Intl.DateTimeFormat,
  timeZone: string,
  businessHoursByDay: Map<number, QueueBusinessHourInput> | null
): Omit<QueueAvailabilityScheduleStatus, "professionalsAvailableNow"> {
  if (!businessHoursByDay) {
    return {
      businessHoursConfigured: false,
      businessOpenNow: null,
      nextBusinessOpeningAt: null,
      businessClosesAt: null,
    };
  }

  const todayKey = getLocalDateKey(nowMs, formatter);
  const todayDayOfWeek = getDayOfWeek(todayKey);
  const todaySchedule = businessHoursByDay.get(todayDayOfWeek);
  let businessOpenNow = false;
  let businessClosesAt: string | null = null;

  if (todaySchedule && !todaySchedule.is_closed) {
    const openMs = localDateTimeToUtcMs(
      todayKey,
      todaySchedule.open_time,
      formatter,
      timeZone
    );
    const closeMs = localDateTimeToUtcMs(
      todayKey,
      todaySchedule.close_time,
      formatter,
      timeZone
    );

    if (closeMs <= openMs) {
      throw new Error(
        `[QueueAvailabilityService] O fechamento da barbearia deve ser posterior à abertura. Data: "${todayKey}".`
      );
    }

    businessOpenNow = nowMs >= openMs && nowMs < closeMs;
    if (businessOpenNow) {
      businessClosesAt = new Date(closeMs).toISOString();
    }
  }

  if (businessOpenNow) {
    return {
      businessHoursConfigured: true,
      businessOpenNow: true,
      nextBusinessOpeningAt: null,
      businessClosesAt,
    };
  }

  let nextBusinessOpeningAt: string | null = null;

  for (let dayOffset = 0; dayOffset <= daysAhead; dayOffset++) {
    const dateKey = addCalendarDays(todayKey, dayOffset);
    const dayOfWeek = getDayOfWeek(dateKey);
    const schedule = businessHoursByDay.get(dayOfWeek);

    if (!schedule || schedule.is_closed) {
      continue;
    }

    const openMs = localDateTimeToUtcMs(
      dateKey,
      schedule.open_time,
      formatter,
      timeZone
    );
    const closeMs = localDateTimeToUtcMs(
      dateKey,
      schedule.close_time,
      formatter,
      timeZone
    );

    if (closeMs <= openMs) {
      throw new Error(
        `[QueueAvailabilityService] O fechamento da barbearia deve ser posterior à abertura. Data: "${dateKey}".`
      );
    }

    if (openMs > nowMs) {
      nextBusinessOpeningAt = new Date(openMs).toISOString();
      break;
    }
  }

  return {
    businessHoursConfigured: true,
    businessOpenNow: false,
    nextBusinessOpeningAt,
    businessClosesAt: null,
  };
}

function buildBarberAvailabilityWindows(
  barber: QueueAvailabilityBarberSource,
  firstDateKey: string,
  daysAhead: number,
  formatter: Intl.DateTimeFormat,
  timeZone: string,
  businessHoursByDay: Map<number, QueueBusinessHourInput> | null,
  allowQueueToContinueAfterClosing: boolean
): QueueAvailabilityWindow[] {
  const scheduleByDay = new Map<number, QueueWorkingHourInput>();

  for (const schedule of barber.working_hours ?? []) {
    if (
      !Number.isInteger(schedule.day_of_week) ||
      schedule.day_of_week < 0 ||
      schedule.day_of_week > 6
    ) {
      throw new Error(
        `[QueueAvailabilityService] Dia da semana inválido no profissional "${barber.id}".`
      );
    }

    if (scheduleByDay.has(schedule.day_of_week)) {
      throw new Error(
        `[QueueAvailabilityService] Existe mais de um expediente para o mesmo dia no profissional "${barber.id}".`
      );
    }

    scheduleByDay.set(schedule.day_of_week, schedule);
  }

  const windows: QueueAvailabilityWindow[] = [];

  for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
    const dateKey = addCalendarDays(firstDateKey, dayOffset);
    const dayOfWeek = getDayOfWeek(dateKey);
    const schedule = scheduleByDay.get(dayOfWeek);
    const businessSchedule = businessHoursByDay?.get(dayOfWeek);

    if (!schedule?.is_active) {
      continue;
    }

    if (!supportsQueue(schedule.service_mode)) {
      continue;
    }

    // Se existe expediente geral cadastrado, dia sem registro ou
    // marcado como fechado não permite iniciar novos atendimentos.
    // Se nenhum expediente geral foi cadastrado, preserva o legado.
    if (
      businessHoursByDay &&
      (!businessSchedule || businessSchedule.is_closed)
    ) {
      continue;
    }

    const shiftStartMs = localDateTimeToUtcMs(
      dateKey,
      schedule.start_time,
      formatter,
      timeZone
    );

    const shiftEndMs = localDateTimeToUtcMs(
      dateKey,
      schedule.end_time,
      formatter,
      timeZone
    );

    if (shiftEndMs <= shiftStartMs) {
      throw new Error(
        `[QueueAvailabilityService] O fim do expediente deve ser posterior ao início. ` +
          `Profissional: "${barber.id}", data: "${dateKey}".`
      );
    }

    let effectiveStartMs = shiftStartMs;
    let effectiveEndMs = shiftEndMs;

    if (businessSchedule) {
      const businessStartMs = localDateTimeToUtcMs(
        dateKey,
        businessSchedule.open_time,
        formatter,
        timeZone
      );

      const businessEndMs = localDateTimeToUtcMs(
        dateKey,
        businessSchedule.close_time,
        formatter,
        timeZone
      );

      if (businessEndMs <= businessStartMs) {
        throw new Error(
          `[QueueAvailabilityService] O fechamento da barbearia deve ser posterior à abertura. ` +
            `Data: "${dateKey}".`
        );
      }

      // Um profissional só pode receber clientes dentro da janela
      // em que ele próprio E a barbearia estão em funcionamento.
      effectiveStartMs = Math.max(shiftStartMs, businessStartMs);
      effectiveEndMs = Math.min(shiftEndMs, businessEndMs);

      if (effectiveEndMs <= effectiveStartMs) {
        continue;
      }
    }

    let availableIntervals: TimeInterval[] = [
      { startMs: effectiveStartMs, endMs: effectiveEndMs },
    ];

    for (const block of barber.time_blocks ?? []) {
      if (!blockAppliesOnDate(block, dateKey)) {
        continue;
      }

      const blockStartMs = localDateTimeToUtcMs(
        dateKey,
        block.start_time,
        formatter,
        timeZone
      );

      const blockEndMs = localDateTimeToUtcMs(
        dateKey,
        block.end_time,
        formatter,
        timeZone
      );

      if (blockEndMs <= blockStartMs) {
        throw new Error(
          `[QueueAvailabilityService] O fim do bloqueio deve ser posterior ao início. ` +
            `Profissional: "${barber.id}", data: "${dateKey}".`
        );
      }

      availableIntervals = subtractInterval(availableIntervals, {
        startMs: blockStartMs,
        endMs: blockEndMs,
      });

      if (availableIntervals.length === 0) {
        break;
      }
    }

    for (const interval of availableIntervals) {
      const availabilityWindow: QueueAvailabilityWindow & {
        allowQueueToContinueAfterWindow?: boolean;
      } = {
        startAt: new Date(interval.startMs).toISOString(),
        endAt: new Date(interval.endMs).toISOString(),
      };

      // Somente a última janela efetivamente disponível do dia pode
      // carregar esta permissão. Assim, a sequência da fila pode avançar
      // depois do fechamento, mas bloqueios intermediários (por exemplo,
      // almoço) continuam sendo respeitados pelo estimador.
      if (
        allowQueueToContinueAfterClosing &&
        interval.endMs === effectiveEndMs
      ) {
        availabilityWindow.allowQueueToContinueAfterWindow = true;
      }

      windows.push(availabilityWindow);
    }
  }

  windows.sort(
    (a, b) => Date.parse(a.startAt) - Date.parse(b.startAt)
  );

  return windows;
}

/**
 * Adaptador puro entre os dados de expediente/bloqueios
 * e o QueueWaitTimeEstimator.
 */
export function buildQueueAvailability(
  input: QueueAvailabilityServiceInput
): QueueAvailabilityServiceResult {
  const nowMs =
    input.now instanceof Date
      ? input.now.getTime()
      : Date.parse(input.now);

  if (!Number.isFinite(nowMs)) {
    throw new Error(
      "[QueueAvailabilityService] Instante de referência inválido."
    );
  }

  const daysAhead = input.daysAhead ?? DEFAULT_HORIZON_DAYS;
  const minimumServiceDurationMinutes =
    input.minimumServiceDurationMinutes ?? 20;

  if (
    !Number.isInteger(minimumServiceDurationMinutes) ||
    minimumServiceDurationMinutes < 1 ||
    minimumServiceDurationMinutes > 480
  ) {
    throw new Error(
      "[QueueAvailabilityService] minimumServiceDurationMinutes deve ser um inteiro entre 1 e 480."
    );
  }

  if (
    !Number.isInteger(daysAhead) ||
    daysAhead < 1 ||
    daysAhead > MAX_HORIZON_DAYS
  ) {
    throw new Error(
      `[QueueAvailabilityService] daysAhead deve ser um inteiro entre 1 e ${MAX_HORIZON_DAYS}.`
    );
  }

  const formatter = createTimeZoneFormatter(input.timeZone);
  const calculatedAt = new Date(nowMs).toISOString();
  const firstDateKey = getLocalDateKey(nowMs, formatter);
  const barberIds = new Set<string>();

  // null significa que a barbearia ainda não possui horários gerais
  // cadastrados. Nesse caso, mantemos compatibilidade com o cálculo
  // anterior baseado apenas na agenda dos profissionais.
  const businessHoursByDay =
    input.business_hours && input.business_hours.length > 0
      ? new Map<number, QueueBusinessHourInput>()
      : null;

  if (businessHoursByDay) {
    for (const businessHour of input.business_hours ?? []) {
      if (
        !Number.isInteger(businessHour.day_of_week) ||
        businessHour.day_of_week < 0 ||
        businessHour.day_of_week > 6
      ) {
        throw new Error(
          "[QueueAvailabilityService] Dia da semana inválido no expediente geral da barbearia."
        );
      }

      if (businessHoursByDay.has(businessHour.day_of_week)) {
        throw new Error(
          `[QueueAvailabilityService] Existe mais de um expediente geral para o dia ${businessHour.day_of_week}.`
        );
      }

      businessHoursByDay.set(businessHour.day_of_week, businessHour);
    }
  }

  const businessScheduleStatus = calculateBusinessScheduleStatus(
    nowMs,
    daysAhead,
    formatter,
    input.timeZone,
    businessHoursByDay
  );

  const barbers: QueueBarberInput[] = input.barbers.map((barber) => {
    if (!barber.id || !barber.name.trim()) {
      throw new Error(
        "[QueueAvailabilityService] Profissional sem ID ou nome."
      );
    }

    if (barberIds.has(barber.id)) {
      throw new Error(
        `[QueueAvailabilityService] Profissional duplicado: "${barber.id}".`
      );
    }

    barberIds.add(barber.id);

    const availabilityWindows = buildBarberAvailabilityWindows(
      barber,
      firstDateKey,
      daysAhead,
      formatter,
      input.timeZone,
      businessHoursByDay,
      input.allowQueueToContinueAfterClosing ?? false
    );

    const serviceMode: QueueServiceMode =
      availabilityWindows.length > 0 ? "queue" : "appointment";

    return {
      id: barber.id,
      name: barber.name,
      isActive: barber.is_active,
      acceptingQueue: barber.accepting_queue,
      serviceMode,
      availabilityWindows,
    };
  });

  const minimumServiceDurationMs =
    minimumServiceDurationMinutes * 60_000;

  const allowQueueToContinueAfterClosing =
    input.allowQueueToContinueAfterClosing ?? false;

  const professionalsAvailableNow = barbers.filter((barber) => {
    if (
      !input.barbershopAcceptsQueue ||
      !barber.isActive ||
      !barber.acceptingQueue ||
      barber.serviceMode !== "queue" && barber.serviceMode !== "hybrid"
    ) {
      return false;
    }

    return barber.availabilityWindows.some((window) => {
      const startMs = Date.parse(window.startAt);
      const endMs = Date.parse(window.endAt);

      if (allowQueueToContinueAfterClosing) {
        // Para a política de aceitação até o fechamento, basta que o
        // profissional esteja dentro de sua janela agora. A duração do
        // atendimento não antecipa o bloqueio da entrada de novos clientes.
        return startMs <= nowMs && nowMs < endMs;
      }

      // Política restritiva: o atendimento completo precisa caber na janela.
      return startMs <= nowMs && nowMs + minimumServiceDurationMs <= endMs;
    });
  }).length;

  return {
    calculatedAt,
    timeZone: input.timeZone,
    horizonDays: daysAhead,
    barbershopAcceptsQueue: input.barbershopAcceptsQueue,
    barbers,
    scheduleStatus: {
      ...businessScheduleStatus,
      professionalsAvailableNow,
    },
  };
}
