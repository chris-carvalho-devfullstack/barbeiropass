BEGIN;

-- ============================================================
-- 1. IDENTIFICAR QUANDO A BARBEARIA CONFIGUROU O TEMPO MANUAL
-- ============================================================

ALTER TABLE public.barbershop_settings
    ADD COLUMN IF NOT EXISTS queue_duration_configured
    boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.barbershop_settings.queue_duration_configured IS
    'Indica se o proprietário ou gerente salvou manualmente '
    'o tempo estimado da Fila Virtual. Quando false, o sistema '
    'utiliza o fallback de 20 minutos.';

-- Para as configurações ainda não marcadas como manuais,
-- o tempo efetivo deve permanecer no fallback do sistema.
-- Configurações marcadas como manuais são preservadas.

UPDATE public.barbershop_settings
SET default_queue_duration_minutes = 20
WHERE queue_duration_configured = false;


-- ============================================================
-- 2. FUNÇÃO PARA REGISTRAR A DURAÇÃO EFETIVA DE NOVAS ENTRADAS
-- E OS TIMESTAMPS DE INÍCIO E FIM
-- ============================================================

CREATE OR REPLACE FUNCTION public.capture_virtual_queue_metrics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    configured_duration integer;
    is_duration_configured boolean;
    effective_duration integer;
BEGIN
    -- --------------------------------------------------------
    -- INSERT: aplicar o tempo geral salvo pela barbearia.
    -- Se nunca houve configuração manual, usar 20 minutos.
    -- --------------------------------------------------------

    IF TG_OP = 'INSERT' THEN
        SELECT
            settings.default_queue_duration_minutes,
            settings.queue_duration_configured
        INTO
            configured_duration,
            is_duration_configured
        FROM public.barbershop_settings AS settings
        WHERE settings.barbershop_id = NEW.barbershop_id
        LIMIT 1;

        IF FOUND AND is_duration_configured = true
           AND configured_duration BETWEEN 1 AND 480 THEN

            effective_duration := configured_duration;

        ELSE
            effective_duration := 20;
        END IF;

        -- A duração fica congelada no ticket no momento da entrada.
        NEW.estimated_duration_minutes := effective_duration;

        -- A coluna possui DEFAULT now(), mas mantemos a garantia
        -- para inserções que enviem joined_at explicitamente nulo.
        IF NEW.joined_at IS NULL THEN
            NEW.joined_at := now();
        END IF;

        -- Compatibilidade com registros inseridos diretamente
        -- em um estado de atendimento ativo.
        IF NEW.status::text IN ('in_progress', 'in_chair')
           AND NEW.started_at IS NULL THEN

            NEW.started_at := now();
        END IF;

        -- Compatibilidade com registros inseridos diretamente
        -- em um estado finalizado.
        IF NEW.status::text IN ('awaiting_payment', 'completed')
           AND NEW.finished_at IS NULL THEN

            NEW.finished_at := now();
        END IF;

        IF NEW.finished_at IS NOT NULL
           AND NEW.started_at IS NOT NULL
           AND NEW.finished_at >= NEW.started_at THEN

            NEW.actual_duration_minutes :=
                GREATEST(
                    0,
                    CEIL(
                        EXTRACT(
                            EPOCH FROM (
                                NEW.finished_at - NEW.started_at
                            )
                        ) / 60.0
                    )::integer
                );
        END IF;

        RETURN NEW;
    END IF;


    -- --------------------------------------------------------
    -- UPDATE: registrar o início real do serviço.
    -- --------------------------------------------------------

    IF OLD.started_at IS NULL
       AND NEW.started_at IS NULL
       AND OLD.status::text = 'waiting'
       AND NEW.status::text IN ('in_progress', 'in_chair') THEN

        NEW.started_at := now();
    END IF;


    -- --------------------------------------------------------
    -- UPDATE: registrar a conclusão do serviço antes do caixa.
    --
    -- A duração é calculada somente quando existe um início
    -- válido. Não inventamos uma duração para tickets legados
    -- cujo horário inicial esteja ausente.
    -- --------------------------------------------------------

    IF OLD.finished_at IS NULL
       AND NEW.finished_at IS NULL
       AND OLD.status::text IN ('in_progress', 'in_chair')
       AND NEW.status::text IN ('awaiting_payment', 'completed') THEN

        NEW.finished_at := now();

        IF NEW.started_at IS NOT NULL
           AND NEW.finished_at >= NEW.started_at THEN

            NEW.actual_duration_minutes :=
                GREATEST(
                    0,
                    CEIL(
                        EXTRACT(
                            EPOCH FROM (
                                NEW.finished_at - NEW.started_at
                            )
                        ) / 60.0
                    )::integer
                );

        ELSE
            NEW.actual_duration_minutes := NULL;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;


-- ============================================================
-- 3. INSTALAR O TRIGGER SEM REMOVER OS TRIGGERS DE REALTIME
-- ============================================================

DROP TRIGGER IF EXISTS trg_virtual_queue_capture_metrics
ON public.virtual_queue;

CREATE TRIGGER trg_virtual_queue_capture_metrics
BEFORE INSERT OR UPDATE
ON public.virtual_queue
FOR EACH ROW
EXECUTE FUNCTION public.capture_virtual_queue_metrics();


-- ============================================================
-- 4. DOCUMENTAÇÃO DOS CAMPOS OPERACIONAIS EXISTENTES
-- ============================================================

COMMENT ON COLUMN public.virtual_queue.joined_at IS
    'Timestamp de entrada na fila.';

COMMENT ON COLUMN public.virtual_queue.started_at IS
    'Timestamp real de início do atendimento.';

COMMENT ON COLUMN public.virtual_queue.finished_at IS
    'Timestamp de conclusão do serviço, antes do fluxo de pagamento.';

COMMENT ON COLUMN public.virtual_queue.actual_duration_minutes IS
    'Duração efetiva em minutos, calculada entre started_at e finished_at.';

COMMENT ON COLUMN public.virtual_queue.estimated_duration_minutes IS
    'Estimativa congelada na entrada conforme o tempo geral efetivo '
    'da barbearia. Tickets anteriores preservam suas estimativas.';

COMMIT;