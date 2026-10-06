-- Identifica a origem de um cancelamento da Fila Virtual.
--
-- O registro da virtual_queue continua sendo preservado para histórico.
-- Esta coluna informa apenas quem provocou o encerramento do ticket:
-- customer   = cliente saiu voluntariamente antes do início
-- barbershop = equipe removeu o cliente antes do início
-- system     = encerramento automático/sistêmico, quando aplicável
--
-- Nenhum dado pessoal é armazenado nesta coluna.

ALTER TABLE public.virtual_queue
ADD COLUMN IF NOT EXISTS cancellation_source text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'virtual_queue_cancellation_source_check'
      AND conrelid = 'public.virtual_queue'::regclass
  ) THEN
    ALTER TABLE public.virtual_queue
      ADD CONSTRAINT virtual_queue_cancellation_source_check
      CHECK (
        cancellation_source IS NULL
        OR cancellation_source IN ('customer', 'barbershop', 'system')
      );
  END IF;
END;
$$;