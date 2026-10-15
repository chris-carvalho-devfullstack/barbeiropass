
-- BarbeiroPass
-- Preparação da infraestrutura para a Fila Virtual Inteligente.
--
-- Esta migration:
-- 1. Separa preferência do cliente e barbeiro responsável.
-- 2. Registra serviços solicitados e duração estimada.
-- 3. Registra início, término e duração real do atendimento.
-- 4. Permite indisponibilidade manual para novos clientes.
-- 5. Define uma duração padrão configurável por barbearia.
--
-- Não altera os status existentes e não modifica os registros históricos
-- de cancelamento.

BEGIN;

-- =========================================================================
-- 1. DISPONIBILIDADE MANUAL DO PROFISSIONAL
-- =========================================================================

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS accepting_queue boolean
  NOT NULL DEFAULT true;

COMMENT ON COLUMN public.staff.accepting_queue IS
  'Indica se o profissional aceita novos clientes da Fila Virtual. '
  'Não encerra nem interrompe atendimentos em andamento.';


-- =========================================================================
-- 2. DURAÇÃO PADRÃO CONFIGURÁVEL POR BARBEARIA
-- =========================================================================

ALTER TABLE public.barbershop_settings
  ADD COLUMN IF NOT EXISTS default_queue_duration_minutes integer
  NOT NULL DEFAULT 20;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname =
      'barbershop_settings_default_queue_duration_check'
      AND conrelid = 'public.barbershop_settings'::regclass
  ) THEN
    ALTER TABLE public.barbershop_settings
      ADD CONSTRAINT
        barbershop_settings_default_queue_duration_check
      CHECK (
        default_queue_duration_minutes BETWEEN 1 AND 480
      );
  END IF;
END;
$migration$;

COMMENT ON COLUMN
  public.barbershop_settings.default_queue_duration_minutes IS
  'Duração estimada padrão, em minutos, quando o cliente não informa '
  'os serviços que pretende realizar.';


-- =========================================================================
-- 3. NOVOS CAMPOS OPERACIONAIS DA FILA
-- =========================================================================

-- Preferência declarada pelo cliente.
-- Não impede que outro barbeiro assuma o atendimento.

ALTER TABLE public.virtual_queue
  ADD COLUMN IF NOT EXISTS preferred_barber_id uuid;

-- Serviços que o cliente informou que pretende realizar.
-- service_ids continua reservado aos serviços efetivamente registrados
-- no fluxo atual de finalização e PDV.

ALTER TABLE public.virtual_queue
  ADD COLUMN IF NOT EXISTS requested_service_ids uuid[]
  NOT NULL DEFAULT ARRAY[]::uuid[];

-- Snapshot da estimativa calculada na entrada.
-- O valor não deverá mudar caso o cadastro do serviço seja alterado depois.

ALTER TABLE public.virtual_queue
  ADD COLUMN IF NOT EXISTS estimated_duration_minutes integer
  NOT NULL DEFAULT 20;

-- Horários efetivos do atendimento.

ALTER TABLE public.virtual_queue
  ADD COLUMN IF NOT EXISTS started_at timestamptz;

ALTER TABLE public.virtual_queue
  ADD COLUMN IF NOT EXISTS finished_at timestamptz;

ALTER TABLE public.virtual_queue
  ADD COLUMN IF NOT EXISTS actual_duration_minutes integer;


-- =========================================================================
-- 4. INTEGRIDADE REFERENCIAL DA PREFERÊNCIA
-- =========================================================================

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'virtual_queue_preferred_barber_fk'
      AND conrelid = 'public.virtual_queue'::regclass
  ) THEN
    ALTER TABLE public.virtual_queue
      ADD CONSTRAINT virtual_queue_preferred_barber_fk
      FOREIGN KEY (preferred_barber_id)
      REFERENCES public.staff(id)
      ON DELETE SET NULL;
  END IF;
END;
$migration$;


-- =========================================================================
-- 5. VALIDAÇÃO DAS DURAÇÕES
-- =========================================================================

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'virtual_queue_estimated_duration_check'
      AND conrelid = 'public.virtual_queue'::regclass
  ) THEN
    ALTER TABLE public.virtual_queue
      ADD CONSTRAINT virtual_queue_estimated_duration_check
      CHECK (
        estimated_duration_minutes BETWEEN 1 AND 480
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'virtual_queue_actual_duration_check'
      AND conrelid = 'public.virtual_queue'::regclass
  ) THEN
    ALTER TABLE public.virtual_queue
      ADD CONSTRAINT virtual_queue_actual_duration_check
      CHECK (
        actual_duration_minutes IS NULL
        OR actual_duration_minutes >= 0
      );
  END IF;
END;
$migration$;


-- =========================================================================
-- 6. ÍNDICES PARA AS CONSULTAS DO MOTOR DA FILA
-- =========================================================================

-- Clientes aguardando, na ordem de chegada.

CREATE INDEX IF NOT EXISTS virtual_queue_waiting_order_idx
  ON public.virtual_queue (barbershop_id, joined_at)
  WHERE status = 'waiting';

-- Preferências declaradas pelos clientes que ainda aguardam.

CREATE INDEX IF NOT EXISTS virtual_queue_preferred_barber_waiting_idx
  ON public.virtual_queue (
    barbershop_id,
    preferred_barber_id,
    joined_at
  )
  WHERE status = 'waiting'
    AND preferred_barber_id IS NOT NULL;

-- Atendimentos ativos associados ao profissional responsável.
-- Incluímos in_chair para compatibilidade com registros legados.

CREATE INDEX IF NOT EXISTS virtual_queue_active_barber_idx
  ON public.virtual_queue (
    barbershop_id,
    barber_id,
    status
  )
  WHERE status IN ('in_progress', 'in_chair')
    AND barber_id IS NOT NULL;


-- =========================================================================
-- 7. DOCUMENTAÇÃO DOS NOVOS CAMPOS
-- =========================================================================

COMMENT ON COLUMN public.virtual_queue.preferred_barber_id IS
  'Profissional preferido pelo cliente. Não representa uma atribuição '
  'exclusiva e não impede outro profissional de iniciar o atendimento.';

COMMENT ON COLUMN public.virtual_queue.requested_service_ids IS
  'IDs dos serviços informados pelo cliente no ingresso na fila.';

COMMENT ON COLUMN public.virtual_queue.estimated_duration_minutes IS
  'Duração estimada congelada no ticket no momento do ingresso na fila.';

COMMENT ON COLUMN public.virtual_queue.started_at IS
  'Data e hora reais do início do atendimento.';

COMMENT ON COLUMN public.virtual_queue.finished_at IS
  'Data e hora reais da conclusão do serviço, antes do fluxo de pagamento.';

COMMENT ON COLUMN public.virtual_queue.actual_duration_minutes IS
  'Duração real calculada a partir do início e término do atendimento.';

COMMIT;
