import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "edge";

const TIME_ZONE = "America/Sao_Paulo";
const DEFAULT_QUEUE_DURATION_MINUTES = 20;
const MAX_QUEUE_DURATION_MINUTES = 480;
const PAGE_SIZE = 1000;

type MetricsPeriod = "day" | "week" | "month";

interface LocalDateParts {
  year: number;
  month: number;
  day: number;
}

interface QueueMetricsTicket {
  id: string;
  status: string | null;
  joined_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  actual_duration_minutes: number | null;
  estimated_duration_minutes: number;
  service_ids: string[] | null;
  barber_id: string | null;
  barber_name: string | null;
}

interface QueueMetricService {
  id: string;
  name: string;
  duration_minutes: number;
}

interface QueueDurationSetting {
  default_queue_duration_minutes: number | null;
  queue_duration_configured: boolean | null;
}

interface QueueMetricsContext {
  barbershopId: string;
  admin: ReturnType<typeof createAdminClient>;
}

interface QueueMetricsErrorContext {
  response: NextResponse;
}

type QueueMetricsAuthorization =
  | QueueMetricsContext
  | QueueMetricsErrorContext;

const saveConfigurationSchema = z
  .object({
    defaultQueueDurationMinutes: z.number().int().min(1).max(480).optional(),
    useSystemDefault: z.boolean().optional().default(false),
  })
  .refine(
    (value) =>
      value.useSystemDefault === true ||
      value.defaultQueueDurationMinutes !== undefined,
    {
      message: "Informe um tempo válido para a fila.",
    }
  );

function isMetricsError(
  value: QueueMetricsAuthorization
): value is QueueMetricsErrorContext {
  return "response" in value;
}

async function authorizeQueueMetrics(): Promise<QueueMetricsAuthorization> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      response: NextResponse.json(
        { error: "Não autorizado." },
        { status: 401 }
      ),
    };
  }

  const { data: member, error: memberError } = await supabase
    .from("barbershop_members")
    .select("barbershop_id, role")
    .eq("profile_id", user.id)
    .single();

  if (memberError || !member) {
    return {
      response: NextResponse.json(
        { error: "Vínculo com a barbearia não encontrado." },
        { status: 404 }
      ),
    };
  }

  if (member.role !== "owner" && member.role !== "manager") {
    return {
      response: NextResponse.json(
        {
          error:
            "Somente o proprietário ou gerente pode acessar as métricas e configurações da fila.",
        },
        { status: 403 }
      ),
    };
  }

  return {
    barbershopId: member.barbershop_id,
    admin: createAdminClient(),
  };
}

function getLocalDateParts(date: Date): LocalDateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(values.get("year")),
    month: Number(values.get("month")),
    day: Number(values.get("day")),
  };
}

function formatDateKey(parts: LocalDateParts): string {
  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
}

function parseDateKey(dateKey: string): LocalDateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);

  if (!match) {
    throw new Error("Data inválida para a consulta de métricas.");
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function shiftDateKey(dateKey: string, days: number): string {
  const parts = parseDateKey(dateKey);

  const shifted = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + days)
  );

  return formatDateKey({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  });
}

function localMidnightToUtc(dateKey: string): Date {
  const parts = parseDateKey(dateKey);

  const targetLocalAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    0,
    0,
    0
  );

  let candidate = targetLocalAsUtc;

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  for (let iteration = 0; iteration < 5; iteration += 1) {
    const dateParts = formatter.formatToParts(new Date(candidate));
    const values = new Map(
      dateParts.map((part) => [part.type, part.value])
    );

    const observedLocalAsUtc = Date.UTC(
      Number(values.get("year")),
      Number(values.get("month")) - 1,
      Number(values.get("day")),
      Number(values.get("hour")),
      Number(values.get("minute")),
      Number(values.get("second"))
    );

    const nextCandidate = candidate + targetLocalAsUtc - observedLocalAsUtc;

    if (nextCandidate === candidate) {
      break;
    }

    candidate = nextCandidate;
  }

  return new Date(candidate);
}

function getMetricsRange(period: MetricsPeriod): {
  start: Date;
  end: Date;
  todayKey: string;
  startKey: string;
  endKey: string;
} {
  const todayKey = formatDateKey(getLocalDateParts(new Date()));
  const todayParts = parseDateKey(todayKey);

  let startKey = todayKey;
  let endKey = shiftDateKey(todayKey, 1);

  if (period === "week") {
    const weekday = new Date(
      Date.UTC(
        todayParts.year,
        todayParts.month - 1,
        todayParts.day
      )
    ).getUTCDay();

    const daysSinceMonday = (weekday + 6) % 7;

    startKey = shiftDateKey(todayKey, -daysSinceMonday);
    endKey = shiftDateKey(startKey, 7);
  }

  if (period === "month") {
    startKey = [
      String(todayParts.year).padStart(4, "0"),
      String(todayParts.month).padStart(2, "0"),
      "01",
    ].join("-");

    const nextMonth = new Date(
      Date.UTC(todayParts.year, todayParts.month, 1)
    );

    endKey = formatDateKey({
      year: nextMonth.getUTCFullYear(),
      month: nextMonth.getUTCMonth() + 1,
      day: nextMonth.getUTCDate(),
    });
  }

  return {
    start: localMidnightToUtc(startKey),
    end: localMidnightToUtc(endKey),
    todayKey,
    startKey,
    endKey,
  };
}

function isTimestampInRange(
  value: string | null,
  start: Date,
  end: Date
): boolean {
  if (!value) {
    return false;
  }

  const timestamp = Date.parse(value);

  return (
    Number.isFinite(timestamp) &&
    timestamp >= start.getTime() &&
    timestamp < end.getTime()
  );
}

function elapsedMinutes(
  start: string | null,
  end: string | null
): number | null {
  if (!start || !end) {
    return null;
  }

  const startMs = Date.parse(start);
  const endMs = Date.parse(end);

  if (
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) ||
    endMs < startMs
  ) {
    return null;
  }

  return (endMs - startMs) / 60_000;
}

function getActualDurationMinutes(
  ticket: QueueMetricsTicket
): number | null {
  if (
    ticket.actual_duration_minutes !== null &&
    Number.isFinite(ticket.actual_duration_minutes) &&
    ticket.actual_duration_minutes >= 0
  ) {
    return ticket.actual_duration_minutes;
  }

  return elapsedMinutes(ticket.started_at, ticket.finished_at);
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function roundMinutes(value: number | null): number | null {
  return value === null ? null : Math.round(value * 10) / 10;
}

function getLocalHour(value: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    hourCycle: "h23",
  });

  return Number(formatter.format(new Date(value)));
}

function getBucketKey(
  period: MetricsPeriod,
  timestamp: string
): string {
  if (period === "day") {
    return String(getLocalHour(timestamp)).padStart(2, "0");
  }

  return formatDateKey(getLocalDateParts(new Date(timestamp)));
}

function getBucketLabel(period: MetricsPeriod, key: string): string {
  if (period === "day") {
    return `${key}h`;
  }

  const parts = parseDateKey(key);

  if (period === "week") {
    const weekday = new Date(
      Date.UTC(parts.year, parts.month - 1, parts.day)
    ).getUTCDay();

    const names = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    return `${names[weekday]} ${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(2, "0")}`;
  }

  return `${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(2, "0")}`;
}

function createBuckets(
  period: MetricsPeriod,
  range: ReturnType<typeof getMetricsRange>
): Array<{
  key: string;
  label: string;
  entries: number;
  started: number;
  finished: number;
  waitTotal: number;
  waitCount: number;
  durationTotal: number;
  durationCount: number;
}> {
  const keys: string[] = [];

  if (period === "day") {
    for (let hour = 0; hour < 24; hour += 1) {
      keys.push(String(hour).padStart(2, "0"));
    }
  } else {
    let currentKey = range.startKey;

    while (currentKey < range.endKey) {
      keys.push(currentKey);
      currentKey = shiftDateKey(currentKey, 1);
    }
  }

  return keys.map((key) => ({
    key,
    label: getBucketLabel(period, key),
    entries: 0,
    started: 0,
    finished: 0,
    waitTotal: 0,
    waitCount: 0,
    durationTotal: 0,
    durationCount: 0,
  }));
}

async function loadQueueTickets(
  admin: ReturnType<typeof createAdminClient>,
  barbershopId: string,
  start: Date
): Promise<QueueMetricsTicket[]> {
  const allTickets: QueueMetricsTicket[] = [];
  let offset = 0;

  while (true) {
    const startIso = start.toISOString();

    const { data, error } = await admin
      .from("virtual_queue")
      .select(
        [
          "id",
          "status",
          "joined_at",
          "started_at",
          "finished_at",
          "actual_duration_minutes",
          "estimated_duration_minutes",
          "service_ids",
          "barber_id",
          "barber_name",
        ].join(", ")
      )
      .eq("barbershop_id", barbershopId)
      .or(
        `joined_at.gte.${startIso},started_at.gte.${startIso},finished_at.gte.${startIso}`
      )
      .order("joined_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error("[QUEUE_METRICS] Erro ao buscar tickets:", error.message);
      throw new Error("Não foi possível consultar os atendimentos da fila.");
    }

    const page = (data ?? []) as unknown as QueueMetricsTicket[];

    allTickets.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }

    offset += PAGE_SIZE;
  }

  return allTickets;
}

function buildQueueMetrics(
  tickets: QueueMetricsTicket[],
  services: QueueMetricService[],
  period: MetricsPeriod,
  range: ReturnType<typeof getMetricsRange>
) {
  const servicesById = new Map(
    services.map((service) => [service.id, service.name])
  );

  const entriesInPeriod = tickets.filter((ticket) =>
    isTimestampInRange(ticket.joined_at, range.start, range.end)
  );

  const startedInPeriod = tickets.filter((ticket) =>
    isTimestampInRange(ticket.started_at, range.start, range.end)
  );

  const finishedInPeriod = tickets.filter((ticket) =>
    isTimestampInRange(ticket.finished_at, range.start, range.end)
  );

  const waitDurations = startedInPeriod
    .map((ticket) => elapsedMinutes(ticket.joined_at, ticket.started_at))
    .filter((value): value is number => value !== null);

  const actualDurations = finishedInPeriod
    .map((ticket) => getActualDurationMinutes(ticket))
    .filter((value): value is number => value !== null);

  const totalDurations = finishedInPeriod
    .map((ticket) => elapsedMinutes(ticket.joined_at, ticket.finished_at))
    .filter((value): value is number => value !== null);

  const buckets = createBuckets(period, range);
  const bucketsByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  for (const ticket of entriesInPeriod) {
    if (!ticket.joined_at) {
      continue;
    }

    const bucket = bucketsByKey.get(
      getBucketKey(period, ticket.joined_at)
    );

    if (bucket) {
      bucket.entries += 1;
    }
  }

  for (const ticket of startedInPeriod) {
    if (!ticket.started_at) {
      continue;
    }

    const bucket = bucketsByKey.get(
      getBucketKey(period, ticket.started_at)
    );

    if (!bucket) {
      continue;
    }

    bucket.started += 1;

    const wait = elapsedMinutes(ticket.joined_at, ticket.started_at);

    if (wait !== null) {
      bucket.waitTotal += wait;
      bucket.waitCount += 1;
    }
  }

  for (const ticket of finishedInPeriod) {
    if (!ticket.finished_at) {
      continue;
    }

    const bucket = bucketsByKey.get(
      getBucketKey(period, ticket.finished_at)
    );

    if (!bucket) {
      continue;
    }

    bucket.finished += 1;

    const duration = getActualDurationMinutes(ticket);

    if (duration !== null) {
      bucket.durationTotal += duration;
      bucket.durationCount += 1;
    }
  }

  const series = buckets.map((bucket) => ({
    label: bucket.label,
    entries: bucket.entries,
    started: bucket.started,
    finished: bucket.finished,
    averageWaitMinutes:
      bucket.waitCount > 0
        ? roundMinutes(bucket.waitTotal / bucket.waitCount)
        : null,
    averageDurationMinutes:
      bucket.durationCount > 0
        ? roundMinutes(bucket.durationTotal / bucket.durationCount)
        : null,
  }));

  const serviceGroups = new Map<
    string,
    {
      label: string;
      count: number;
      durations: number[];
    }
  >();

  for (const ticket of finishedInPeriod) {
    const serviceIds = (ticket.service_ids ?? [])
      .filter((id): id is string => typeof id === "string");

    if (serviceIds.length === 0) {
      continue;
    }

    const serviceNames = serviceIds
      .map((id) => servicesById.get(id))
      .filter((name): name is string => Boolean(name))
      .sort((a, b) => a.localeCompare(b, "pt-BR"));

    if (serviceNames.length === 0) {
      continue;
    }

    const groupKey = serviceNames.join(" + ");

    const existing = serviceGroups.get(groupKey) ?? {
      label: groupKey,
      count: 0,
      durations: [],
    };

    existing.count += 1;

    const duration = getActualDurationMinutes(ticket);

    if (duration !== null) {
      existing.durations.push(duration);
    }

    serviceGroups.set(groupKey, existing);
  }

  const byService = [...serviceGroups.values()]
    .map((group) => ({
      label: group.label,
      count: group.count,
      averageDurationMinutes: roundMinutes(average(group.durations)),
    }))
    .sort((a, b) => b.count - a.count);

  const barberGroups = new Map<
    string,
    {
      id: string;
      name: string;
      started: number;
      finished: number;
      waits: number[];
      durations: number[];
    }
  >();

  function getBarberGroup(ticket: QueueMetricsTicket) {
    const id = ticket.barber_id || ticket.barber_name || "unknown";
    const name = ticket.barber_name?.trim() || "Profissional não identificado";

    const existing = barberGroups.get(id) ?? {
      id,
      name,
      started: 0,
      finished: 0,
      waits: [],
      durations: [],
    };

    barberGroups.set(id, existing);

    return existing;
  }

  for (const ticket of startedInPeriod) {
    if (!ticket.barber_id && !ticket.barber_name) {
      continue;
    }

    const group = getBarberGroup(ticket);

    group.started += 1;

    const wait = elapsedMinutes(ticket.joined_at, ticket.started_at);

    if (wait !== null) {
      group.waits.push(wait);
    }
  }

  for (const ticket of finishedInPeriod) {
    if (!ticket.barber_id && !ticket.barber_name) {
      continue;
    }

    const group = getBarberGroup(ticket);

    group.finished += 1;

    const duration = getActualDurationMinutes(ticket);

    if (duration !== null) {
      group.durations.push(duration);
    }
  }

  const byBarber = [...barberGroups.values()]
    .map((group) => ({
      id: group.id,
      name: group.name,
      started: group.started,
      finished: group.finished,
      averageWaitMinutes: roundMinutes(average(group.waits)),
      averageDurationMinutes: roundMinutes(average(group.durations)),
    }))
    .sort((a, b) => b.finished - a.finished);

  return {
    overview: {
      entries: entriesInPeriod.length,
      started: startedInPeriod.length,
      finished: finishedInPeriod.length,
      averageWaitMinutes: roundMinutes(average(waitDurations)),
      averageDurationMinutes: roundMinutes(average(actualDurations)),
      averageTotalMinutes: roundMinutes(average(totalDurations)),
    },
    series,
    byService,
    byBarber,
  };
}

export async function GET(request: Request) {
  try {
    const authorization = await authorizeQueueMetrics();

    if (isMetricsError(authorization)) {
      return authorization.response;
    }

    const url = new URL(request.url);
    const periodParam = url.searchParams.get("period");

    const period: MetricsPeriod =
      periodParam === "day" ||
      periodParam === "week" ||
      periodParam === "month"
        ? periodParam
        : "week";

    const range = getMetricsRange(period);

    const [settingsResult, servicesResult, tickets] = await Promise.all([
      authorization.admin
        .from("barbershop_settings")
        .select(
          "default_queue_duration_minutes, queue_duration_configured"
        )
        .eq("barbershop_id", authorization.barbershopId)
        .maybeSingle(),

      authorization.admin
        .from("services")
        .select("id, name, duration_minutes")
        .eq("barbershop_id", authorization.barbershopId),

      loadQueueTickets(
        authorization.admin,
        authorization.barbershopId,
        range.start
      ),
    ]);

    if (settingsResult.error) {
      console.error(
        "[QUEUE_METRICS] Erro ao consultar a configuração:",
        settingsResult.error.message
      );

      return NextResponse.json(
        { error: "Não foi possível carregar a configuração da fila." },
        { status: 500 }
      );
    }

    if (servicesResult.error) {
      console.error(
        "[QUEUE_METRICS] Erro ao consultar os serviços:",
        servicesResult.error.message
      );

      return NextResponse.json(
        { error: "Não foi possível carregar os serviços da barbearia." },
        { status: 500 }
      );
    }

    const settings =
      settingsResult.data as QueueDurationSetting | null;

    const isManuallyConfigured =
      settings?.queue_duration_configured === true;

    const configuredDuration =
      settings?.default_queue_duration_minutes;

    const defaultQueueDurationMinutes =
      isManuallyConfigured &&
      configuredDuration !== null &&
      configuredDuration !== undefined &&
      Number.isInteger(configuredDuration) &&
      configuredDuration >= 1 &&
      configuredDuration <= MAX_QUEUE_DURATION_MINUTES
        ? configuredDuration
        : DEFAULT_QUEUE_DURATION_MINUTES;

    const metrics = buildQueueMetrics(
      tickets,
      (servicesResult.data ?? []) as QueueMetricService[],
      period,
      range
    );

    return NextResponse.json({
      success: true,
      period,
      timeZone: TIME_ZONE,
      range: {
        start: range.start.toISOString(),
        end: range.end.toISOString(),
      },
      configuration: {
        defaultQueueDurationMinutes,
        isManuallyConfigured,
        fallbackMinutes: DEFAULT_QUEUE_DURATION_MINUTES,
      },
      ...metrics,
    });
  } catch (error) {
    console.error("[QUEUE_METRICS_GET]", error);

    return NextResponse.json(
      { error: "Erro interno ao consultar as métricas da fila." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const authorization = await authorizeQueueMetrics();

    if (isMetricsError(authorization)) {
      return authorization.response;
    }

    const body = await request.json().catch(() => null);
    const parsed = saveConfigurationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            "Dados inválidos. Informe um tempo inteiro entre 1 e 480 minutos ou restaure o padrão do sistema.",
        },
        { status: 400 }
      );
    }

    const useSystemDefault = parsed.data.useSystemDefault === true;

    const duration = useSystemDefault
      ? DEFAULT_QUEUE_DURATION_MINUTES
      : parsed.data.defaultQueueDurationMinutes;

    if (duration === undefined) {
      return NextResponse.json(
        { error: "Informe o tempo estimado da fila." },
        { status: 400 }
      );
    }

    const { data: savedSettings, error: saveError } =
      await authorization.admin
        .from("barbershop_settings")
        .upsert(
          {
            barbershop_id: authorization.barbershopId,
            default_queue_duration_minutes: duration,
            queue_duration_configured: !useSystemDefault,
          },
          { onConflict: "barbershop_id" }
        )
        .select(
          "default_queue_duration_minutes, queue_duration_configured"
        )
        .single();

    if (saveError || !savedSettings) {
      console.error(
        "[QUEUE_METRICS] Erro ao salvar configuração:",
        saveError?.message
      );

      return NextResponse.json(
        { error: "Não foi possível salvar a configuração da fila." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      configuration: {
        defaultQueueDurationMinutes:
          savedSettings.queue_duration_configured
            ? savedSettings.default_queue_duration_minutes
            : DEFAULT_QUEUE_DURATION_MINUTES,
        isManuallyConfigured:
          savedSettings.queue_duration_configured === true,
        fallbackMinutes: DEFAULT_QUEUE_DURATION_MINUTES,
      },
    });
  } catch (error) {
    console.error("[QUEUE_METRICS_POST]", error);

    return NextResponse.json(
      { error: "Erro interno ao salvar a configuração da fila." },
      { status: 500 }
    );
  }
}