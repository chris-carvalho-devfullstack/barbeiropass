
/**
 * BarbeiroPass — Queue Wait Time Estimator
 *
 * Responsabilidades:
 * - Simular atendimentos de vários barbeiros em paralelo.
 * - Respeitar a ordem de chegada ao distribuir os clientes.
 * - Considerar clientes com preferência por um profissional.
 * - Permitir que outro profissional seja projetado como alternativa.
 * - Descontar o tempo já transcorrido de atendimentos em andamento.
 * - Respeitar intervalos de expediente e pausas fornecidos pelo backend.
 * - Calcular posição geral, pessoas à frente, posição projetada
 *   por profissional e tempo estimado.
 *
 * Este módulo NÃO acessa Supabase, React, APIs ou relógio global.
 * Todos os dados necessários são recebidos como parâmetros.
 */

export type QueueServiceMode =
  | "appointment"
  | "queue"
  | "hybrid";

export type QueueOperationalStatus =
  | "waiting"
  | "in_progress"
  | "in_chair";

export interface QueueAvailabilityWindow {
  /**
   * Início do intervalo em ISO 8601 com timezone.
   * Exemplo: 2026-10-09T09:00:00-03:00
   */
  startAt: string;

  /**
   * Fim do intervalo em ISO 8601 com timezone.
   */
  endAt: string;

  /**
   * Quando true, indica que este é o fim da última janela de disponibilidade
   * do dia e que, se a política permitir, os atendimentos já aceitos na fila
   * podem continuar sendo projetados depois deste horário.
   *
   * Esta marcação não permite ignorar pausas intermediárias; deve ser aplicada
   * pelo backend somente à última janela efetivamente disponível do dia.
   */
  allowQueueToContinueAfterWindow?: boolean;
}

export interface QueueBarberInput {
  id: string;
  name: string;

  isActive: boolean;
  acceptingQueue: boolean;
  serviceMode: QueueServiceMode;

  /**
   * Intervalos nos quais o profissional pode começar e concluir
   * integralmente um novo atendimento.
   *
   * O backend deverá gerar estes intervalos a partir de:
   * - staff_working_hours;
   * - staff_time_blocks;
   * - disponibilidade manual;
   * - configuração global da fila da barbearia.
   *
   * Pausas e períodos fora do expediente não devem estar incluídos
   * dentro destes intervalos.
   */
  availabilityWindows: QueueAvailabilityWindow[];
}

export interface QueueTicketInput {
  id: string;

  status: QueueOperationalStatus | string;

  joinedAt: string | null;

  /**
   * Profissional que efetivamente atende o cliente.
   * Em tickets waiting, normalmente será null.
   */
  barberId: string | null;

  /**
   * Preferência declarada pelo cliente.
   * Não é uma atribuição exclusiva.
   */
  preferredBarberId: string | null;

  /**
   * Duração estimada, em minutos, já calculada pelo backend
   * e congelada no ticket.
   */
  estimatedDurationMinutes: number;

  /**
   * Horário efetivo de início do atendimento.
   *
   * Caso seja null num atendimento legado já iniciado,
   * o motor assume conservadoramente que a duração estimada
   * ainda é necessária.
   */
  startedAt: string | null;
}

export interface QueueWaitTimeEstimatorInput {
  now: Date | string;

  barbershopAcceptsQueue: boolean;

  barbers: QueueBarberInput[];

  /**
   * Pode conter tickets waiting, in_progress e in_chair.
   * Outros status são ignorados pelo simulador.
   */
  tickets: QueueTicketInput[];

  /**
   * Ticket virtual opcional para simular uma nova entrada
   * antes do check-in efetivo.
   *
   * Ele será colocado depois dos clientes que já aguardam,
   * independentemente do valor de joinedAt.
   */
  previewTicket?: QueueTicketInput | null;

  /**
   * Quando true, permite que a projeção dos atendimentos que já estão na fila
   * continue depois do encerramento, usando a última janela diária marcada
   * com allowQueueToContinueAfterWindow.
   *
   * Esta opção não altera a decisão de aceitar novas entradas; essa decisão
   * continua sendo responsabilidade da camada de disponibilidade/API.
   * Por padrão, false mantém a regra restritiva atual.
   */
  allowQueueToContinueAfterClosing?: boolean;
}

export interface ActiveServiceEstimate {
  ticketId: string;
  barberId: string | null;

  expectedFinishAt: string;
  remainingMinutes: number;

  isOverdue: boolean;
  hasUnknownStartTime: boolean;
}

export interface QueueTicketEstimate {
  ticketId: string;

  /**
   * Posição na ordem geral de chegada.
   * A primeira posição é 1.
   */
  position: number;

  /**
   * Número de clientes que chegaram antes deste ticket.
   */
  peopleAhead: number;

  /**
   * Posição entre os tickets que também declararam preferência
   * pelo mesmo profissional.
   *
   * Não representa a distribuição projetada entre profissionais.
   */
  preferredBarberPosition: number | null;

  preferredBarberPeopleAhead: number | null;

  /**
   * Profissional para quem o atendimento foi projetado.
   * Pode ser diferente do preferido.
   */
  projectedBarberId: string | null;
  projectedBarberName: string | null;

  /**
   * Posição na sequência de atendimentos projetada
   * para o profissional selecionado pelo simulador.
   */
  projectedBarberPosition: number | null;

  estimatedStartAt: string | null;

  /**
   * Minutos inteiros até o início projetado.
   * Zero significa que o atendimento poderia começar agora.
   * null significa que não foi encontrada uma oportunidade
   * nos intervalos recebidos.
   */
  estimatedWaitMinutes: number | null;

  /**
   * Estimativa hipotética caso o cliente aguardasse
   * exclusivamente o seu profissional preferido.
   *
   * Não reserva horário e não impede outro profissional
   * de iniciar o atendimento.
   */
  estimatedWaitForPreferredBarberMinutes: number | null;

  usesAlternativeBarber: boolean;

  /**
   * Indica que o horário projetado do profissional está
   * condicionado à duração estimada de serviços anteriores.
   */
  calculatedAt: string;
}

export interface QueueBarberSnapshot {
  barberId: string;
  barberName: string;

  eligibleForNewClients: boolean;

  currentActiveTickets: number;
  hasConflictingActiveTickets: boolean;

  /**
   * Horário de liberação calculado a partir dos atendimentos
   * já em andamento, antes de distribuir novos tickets.
   */
  expectedReleaseAt: string;
}

export interface QueueWaitTimeEstimatorResult {
  calculatedAt: string;

  totalWaiting: number;

  estimates: QueueTicketEstimate[];

  activeServices: ActiveServiceEstimate[];

  barbers: QueueBarberSnapshot[];
}

interface NormalizedWindow {
  startMs: number;
  endMs: number;
  allowQueueToContinueAfterWindow?: boolean;
}

interface BarberTimeline {
  barber: QueueBarberInput;
  windows: NormalizedWindow[];

  nextAvailableAtMs: number;

  projectedTicketCount: number;
  currentActiveTicketCount: number;

  hasConflictingActiveTickets: boolean;

  eligibleForNewClients: boolean;
}

interface WaitingEntry {
  ticket: QueueTicketInput;
  originalIndex: number;
  isPreview: boolean;
}

interface CandidateStart {
  timeline: BarberTimeline;
  startMs: number;
}

interface InternalEstimate {
  ticketId: string;

  position: number;
  peopleAhead: number;

  preferredBarberPosition: number | null;
  preferredBarberPeopleAhead: number | null;

  projectedBarberId: string | null;
  projectedBarberName: string | null;
  projectedBarberPosition: number | null;

  estimatedStartAt: string | null;
  estimatedWaitMinutes: number | null;
  estimatedWaitForPreferredBarberMinutes: number | null;

  usesAlternativeBarber: boolean;
}

const MINUTE_MS = 60_000;
const MAX_DURATION_MINUTES = 480;

function parseTimestamp(
  value: string | Date,
  fieldName: string
): number {
  const timestamp =
    value instanceof Date
      ? value.getTime()
      : Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    throw new Error(
      `[QueueWaitTimeEstimator] Data inválida em "${fieldName}".`
    );
  }

  return timestamp;
}

function validateDuration(
  duration: number,
  ticketId: string
): number {
  if (
    !Number.isInteger(duration) ||
    duration < 1 ||
    duration > MAX_DURATION_MINUTES
  ) {
    throw new Error(
      `[QueueWaitTimeEstimator] Duração inválida no ticket "${ticketId}".`
    );
  }

  return duration;
}

function normalizeWindows(
  windows: QueueAvailabilityWindow[],
  barberId: string
): NormalizedWindow[] {
  const parsed = windows.map((window) => {
    const startMs = Date.parse(window.startAt);
    const endMs = Date.parse(window.endAt);

    if (
      !Number.isFinite(startMs) ||
      !Number.isFinite(endMs)
    ) {
      throw new Error(
        `[QueueWaitTimeEstimator] Intervalo inválido do profissional "${barberId}".`
      );
    }

    if (endMs <= startMs) {
      throw new Error(
        `[QueueWaitTimeEstimator] Fim do intervalo deve ser posterior ao início: "${barberId}".`
      );
    }

    return {
      startMs,
      endMs,
      allowQueueToContinueAfterWindow:
        window.allowQueueToContinueAfterWindow === true,
    };
  });

  parsed.sort((a, b) => a.startMs - b.startMs);

  /**
   * Une intervalos sobrepostos para impedir que o motor conte
   * duas vezes o mesmo período de disponibilidade.
   */
  const merged: NormalizedWindow[] = [];

  for (const window of parsed) {
    const last = merged[merged.length - 1];

    if (!last || window.startMs > last.endMs) {
      merged.push({ ...window });
      continue;
    }

    // Ao unir intervalos sobrepostos, mantemos a permissão de continuidade
    // somente se ela estiver presente no intervalo que define o fim resultante.
    if (window.endMs > last.endMs) {
      last.endMs = window.endMs;
      last.allowQueueToContinueAfterWindow =
        window.allowQueueToContinueAfterWindow === true;
    } else if (window.endMs === last.endMs) {
      last.allowQueueToContinueAfterWindow =
        last.allowQueueToContinueAfterWindow === true ||
        window.allowQueueToContinueAfterWindow === true;
    }
  }

  return merged;
}

function findEarliestStart(
  timeline: BarberTimeline,
  earliestMs: number,
  durationMinutes: number,
  allowQueueToContinueAfterClosing: boolean
): number | null {
  const durationMs = durationMinutes * MINUTE_MS;

  for (const window of timeline.windows) {
    const canContinueAfterWindow =
      allowQueueToContinueAfterClosing &&
      window.allowQueueToContinueAfterWindow === true;

    if (window.endMs <= earliestMs) {
      // Uma vez alcançado o fim da última janela diária marcada, a fila
      // já admitida pode continuar sequencialmente após o fechamento.
      // A política restritiva não entra neste caminho.
      if (canContinueAfterWindow) {
        return earliestMs;
      }

      continue;
    }

    const candidateStartMs = Math.max(
      earliestMs,
      window.startMs
    );

    const candidateFinishMs =
      candidateStartMs + durationMs;

    /**
     * No modo restritivo, o atendimento precisa caber integralmente
     * no intervalo disponível. No modo de continuidade, somente a última
     * janela diária marcada pelo backend pode permitir que o atendimento
     * ultrapasse seu fim; pausas intermediárias continuam sendo respeitadas.
     */
    if (
      candidateStartMs < window.endMs &&
      (
        canContinueAfterWindow ||
        candidateFinishMs <= window.endMs
      )
    ) {
      return candidateStartMs;
    }
  }

  return null;
}

function minutesUntil(
  nowMs: number,
  targetMs: number
): number {
  return Math.max(
    0,
    Math.ceil((targetMs - nowMs) / MINUTE_MS)
  );
}

function isActiveStatus(status: string): boolean {
  return (
    status === "in_progress" ||
    status === "in_chair"
  );
}

function isWaitingStatus(status: string): boolean {
  return status === "waiting";
}

function isEligible(
  barber: QueueBarberInput,
  barbershopAcceptsWalkIn: boolean
): boolean {
  return (
    barbershopAcceptsWalkIn &&
    barber.isActive &&
    barber.acceptingQueue &&
    (
      barber.serviceMode === "queue" ||
      barber.serviceMode === "hybrid"
    )
  );
}

function compareWaitingEntries(
  a: WaitingEntry,
  b: WaitingEntry
): number {
  const aJoinedAt = a.ticket.joinedAt
    ? Date.parse(a.ticket.joinedAt)
    : Number.POSITIVE_INFINITY;

  const bJoinedAt = b.ticket.joinedAt
    ? Date.parse(b.ticket.joinedAt)
    : Number.POSITIVE_INFINITY;

  const normalizedA = Number.isFinite(aJoinedAt)
    ? aJoinedAt
    : Number.POSITIVE_INFINITY;

  const normalizedB = Number.isFinite(bJoinedAt)
    ? bJoinedAt
    : Number.POSITIVE_INFINITY;

  if (normalizedA !== normalizedB) {
    return normalizedA - normalizedB;
  }

  if (a.ticket.id !== b.ticket.id) {
    return a.ticket.id.localeCompare(b.ticket.id);
  }

  return a.originalIndex - b.originalIndex;
}

function selectCandidate(
  candidates: CandidateStart[],
  preferredBarberId: string | null
): CandidateStart | null {
  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    if (a.startMs !== b.startMs) {
      return a.startMs - b.startMs;
    }

    const aIsPreferred =
      a.timeline.barber.id === preferredBarberId;

    const bIsPreferred =
      b.timeline.barber.id === preferredBarberId;

    if (aIsPreferred !== bIsPreferred) {
      return aIsPreferred ? -1 : 1;
    }

    return a.timeline.barber.id.localeCompare(
      b.timeline.barber.id
    );
  });

  return candidates[0];
}

export function estimateQueueWaitTimes(
  input: QueueWaitTimeEstimatorInput
): QueueWaitTimeEstimatorResult {
  const nowMs = parseTimestamp(input.now, "now");
  const calculatedAt = new Date(nowMs).toISOString();

  const barberIds = new Set<string>();

  const timelines: BarberTimeline[] =
    input.barbers.map((barber) => {
      if (barberIds.has(barber.id)) {
        throw new Error(
          `[QueueWaitTimeEstimator] Profissional duplicado: "${barber.id}".`
        );
      }

      barberIds.add(barber.id);

      return {
        barber,
        windows: normalizeWindows(
          barber.availabilityWindows,
          barber.id
        ),
        nextAvailableAtMs: nowMs,
        projectedTicketCount: 0,
        currentActiveTicketCount: 0,
        hasConflictingActiveTickets: false,
        eligibleForNewClients: isEligible(
          barber,
          input.barbershopAcceptsQueue
        ),
      };
    });

  const timelineByBarberId = new Map(
    timelines.map((timeline) => [
      timeline.barber.id,
      timeline,
    ])
  );

  const activeServices: ActiveServiceEstimate[] = [];

  /**
   * Primeiro registramos a carga que já existe.
   * Um atendimento em andamento continua ocupando o barbeiro,
   * mesmo que ele tenha ficado indisponível para novas entradas.
   */
  for (const ticket of input.tickets) {
    if (!isActiveStatus(ticket.status)) {
      continue;
    }

    const duration = validateDuration(
      ticket.estimatedDurationMinutes,
      ticket.id
    );

    const startedAtMs = ticket.startedAt
      ? Date.parse(ticket.startedAt)
      : Number.NaN;

    const hasUnknownStartTime =
      !Number.isFinite(startedAtMs);

    const expectedFinishMs = hasUnknownStartTime
      ? nowMs + duration * MINUTE_MS
      : startedAtMs + duration * MINUTE_MS;

    const expectedFinishIso =
      new Date(expectedFinishMs).toISOString();

    const isOverdue = expectedFinishMs < nowMs;

    activeServices.push({
      ticketId: ticket.id,
      barberId: ticket.barberId,
      expectedFinishAt: expectedFinishIso,
      remainingMinutes: minutesUntil(
        nowMs,
        expectedFinishMs
      ),
      isOverdue,
      hasUnknownStartTime,
    });

    if (!ticket.barberId) {
      continue;
    }

    const timeline = timelineByBarberId.get(
      ticket.barberId
    );

    if (!timeline) {
      continue;
    }

    timeline.currentActiveTicketCount += 1;

    if (timeline.currentActiveTicketCount > 1) {
      timeline.hasConflictingActiveTickets = true;
    }

    /**
     * Quando há mais de um atendimento ativo para o mesmo
     * profissional devido a dados legados, usamos a maior
     * previsão de liberação. A inconsistência é exposta no
     * resultado para permitir diagnóstico posterior.
     */
    timeline.nextAvailableAtMs = Math.max(
      timeline.nextAvailableAtMs,
      expectedFinishMs,
      nowMs
    );
  }

  const barberSnapshots: QueueBarberSnapshot[] =
    timelines.map((timeline) => ({
      barberId: timeline.barber.id,
      barberName: timeline.barber.name,
      eligibleForNewClients:
        timeline.eligibleForNewClients,
      currentActiveTickets:
        timeline.currentActiveTicketCount,
      hasConflictingActiveTickets:
        timeline.hasConflictingActiveTickets,
      expectedReleaseAt: new Date(
        timeline.nextAvailableAtMs
      ).toISOString(),
    }));

  const waitingEntries: WaitingEntry[] =
    input.tickets
      .map((ticket, originalIndex) => ({
        ticket,
        originalIndex,
        isPreview: false,
      }))
      .filter(({ ticket }) =>
        isWaitingStatus(ticket.status)
      )
      .sort(compareWaitingEntries);

  /**
   * A entrada simulada é anexada depois dos clientes já
   * aguardando. Não criamos nem persistimos um ticket real.
   */
  if (input.previewTicket) {
    if (
      input.tickets.some(
        (ticket) => ticket.id === input.previewTicket?.id
      )
    ) {
      throw new Error(
        "[QueueWaitTimeEstimator] O ticket de simulação possui ID já existente."
      );
    }

    waitingEntries.push({
      ticket: input.previewTicket,
      originalIndex: input.tickets.length,
      isPreview: true,
    });
  }

  const preferredCounts = new Map<string, number>();
  const estimates: QueueTicketEstimate[] = [];

  for (let index = 0; index < waitingEntries.length; index++) {
    const entry = waitingEntries[index];
    const ticket = entry.ticket;

    const duration = validateDuration(
      ticket.estimatedDurationMinutes,
      ticket.id
    );

    const preferredBarberId =
      ticket.preferredBarberId;

    const preferredBarberPosition =
      preferredBarberId
        ? (
            preferredCounts.get(preferredBarberId) ?? 0
          ) + 1
        : null;

    const preferredBarberPeopleAhead =
      preferredBarberPosition === null
        ? null
        : preferredBarberPosition - 1;

    if (preferredBarberId) {
      preferredCounts.set(
        preferredBarberId,
        preferredBarberPosition!
      );
    }

    /**
     * Estimativa hipotética para o profissional preferido.
     * Esta consulta não reserva o intervalo desse profissional.
     */
    const preferredTimeline = preferredBarberId
      ? timelineByBarberId.get(preferredBarberId)
      : undefined;

    const preferredStartMs =
      preferredTimeline?.eligibleForNewClients
        ? findEarliestStart(
            preferredTimeline,
            preferredTimeline.nextAvailableAtMs,
            duration,
            input.allowQueueToContinueAfterClosing ?? false
          )
        : null;

    const estimatedWaitForPreferredBarberMinutes =
      preferredStartMs === null
        ? null
        : minutesUntil(nowMs, preferredStartMs);

    /**
     * Simulamos o mesmo cliente sobre todos os profissionais
     * elegíveis. A preferência desempata horários iguais,
     * mas não bloqueia uma alternativa mais rápida.
     */
    const candidates: CandidateStart[] = [];

    for (const timeline of timelines) {
      if (!timeline.eligibleForNewClients) {
        continue;
      }

      const startMs = findEarliestStart(
        timeline,
        timeline.nextAvailableAtMs,
        duration,
        input.allowQueueToContinueAfterClosing ?? false
      );

      if (startMs === null) {
        continue;
      }

      candidates.push({
        timeline,
        startMs,
      });
    }

    const selected = selectCandidate(
      candidates,
      preferredBarberId
    );

    let projectedBarberId: string | null = null;
    let projectedBarberName: string | null = null;
    let projectedBarberPosition: number | null = null;

    let estimatedStartAt: string | null = null;
    let estimatedWaitMinutes: number | null = null;

    if (selected) {
      const timeline = selected.timeline;
      const startMs = selected.startMs;

      projectedBarberId = timeline.barber.id;
      projectedBarberName = timeline.barber.name;

      timeline.projectedTicketCount += 1;
      projectedBarberPosition =
        timeline.projectedTicketCount;

      estimatedStartAt = new Date(
        startMs
      ).toISOString();

      estimatedWaitMinutes = minutesUntil(
        nowMs,
        startMs
      );

      timeline.nextAvailableAtMs =
        startMs + duration * MINUTE_MS;
    }

    estimates.push({
      ticketId: ticket.id,

      position: index + 1,
      peopleAhead: index,

      preferredBarberPosition,
      preferredBarberPeopleAhead,

      projectedBarberId,
      projectedBarberName,
      projectedBarberPosition,

      estimatedStartAt,
      estimatedWaitMinutes,
      estimatedWaitForPreferredBarberMinutes,

      usesAlternativeBarber: Boolean(
        preferredBarberId &&
        projectedBarberId &&
        preferredBarberId !== projectedBarberId
      ),

      calculatedAt,
    });
  }

  return {
    calculatedAt,
    totalWaiting: waitingEntries.length,
    estimates,
    activeServices,
    barbers: barberSnapshots,
  };
}
