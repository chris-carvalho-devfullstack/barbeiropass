-- BarbeiroPass — configuração do estimador e política de aceitação.
--
-- restrict_by_capacity:
--   A fila pública só aceita uma nova entrada quando o atendimento
--   projetado pode começar e terminar dentro dos horários aplicáveis.
--
-- accept_until_closing:
--   A fila pública aceita novas entradas enquanto a barbearia estiver
--   aberta e houver profissional elegível no horário atual. A fila já
--   aceita pode continuar sendo atendida após o fechamento.
--
-- Os tickets existentes não têm suas durações alteradas.
-- A entrada manual pelo painel permanece independente da política pública.
-- As métricas não alteram automaticamente a configuração.

BEGIN;

-- ================================================================
-- 1. INDICADOR DE CONFIGURAÇÃO MANUAL DA DURAÇÃO
-- ================================================================

ALTER TABLE public.barbershop_settings
  ADD COLUMN IF NOT EXISTS queue_duration_configured boolean
  NOT NULL DEFAULT false;

-- Preserva a compatibilidade com instalações antigas em que já havia
-- uma duração diferente do padrão, mas ainda não existia o indicador.
-- Não sobrescreve uma escolha manual que já esteja registrada como true.

UPDATE public.barbershop_settings
SET queue_duration_configured = true
WHERE queue_duration_configured = false
  AND default_queue_duration_minutes <> 20;

-- ================================================================
-- 2. POLÍTICA DE ACEITAÇÃO DA FILA PÚBLICA
-- ================================================================

ALTER TABLE public.barbershop_settings
  ADD COLUMN IF NOT EXISTS queue_acceptance_policy text
  NOT NULL DEFAULT 'restrict_by_capacity';

UPDATE public.barbershop_settings
SET queue_acceptance_policy = 'restrict_by_capacity'
WHERE queue_acceptance_policy IS NULL
   OR queue_acceptance_policy NOT IN (
     'accept_until_closing',
     'restrict_by_capacity'
   );

ALTER TABLE public.barbershop_settings
  ALTER COLUMN queue_acceptance_policy
  SET DEFAULT 'restrict_by_capacity';

ALTER TABLE public.barbershop_settings
  ALTER COLUMN queue_acceptance_policy
  SET NOT NULL;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'barbershop_settings_queue_acceptance_policy_check'
      AND conrelid = 'public.barbershop_settings'::regclass
  ) THEN
    ALTER TABLE public.barbershop_settings
      ADD CONSTRAINT barbershop_settings_queue_acceptance_policy_check
      CHECK (
        queue_acceptance_policy IN (
          'accept_until_closing',
          'restrict_by_capacity'
        )
      );
  END IF;
END;
$migration$;

COMMENT ON COLUMN public.barbershop_settings.queue_acceptance_policy IS
  'Política para aceitar novas entradas pela fila pública. '
  'accept_until_closing permite receber entradas até o fechamento, '
  'mesmo quando o atendimento da fila terminará depois. '
  'restrict_by_capacity exige que o atendimento projetado caiba '
  'nos horários aplicáveis.';

COMMENT ON COLUMN public.barbershop_settings.queue_duration_configured IS
  'Indica se a duração geral do estimador foi definida manualmente '
  'pelo responsável da barbearia.';

COMMIT;