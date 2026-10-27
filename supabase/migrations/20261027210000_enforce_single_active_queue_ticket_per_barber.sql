-- Garante que um barbeiro não tenha dois atendimentos ativos na fila ao mesmo tempo.
-- Antes de criar o índice, falha explicitamente se já houver dados conflitantes,
-- para que nenhum atendimento existente seja cancelado ou alterado automaticamente.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.virtual_queue
    WHERE barber_id IS NOT NULL
      AND status IN ('in_progress', 'in_chair')
    GROUP BY barbershop_id, barber_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Há barbeiros com mais de um atendimento ativo em public.virtual_queue. Resolva os registros duplicados antes de aplicar o índice virtual_queue_one_active_ticket_per_barber_idx.';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS virtual_queue_one_active_ticket_per_barber_idx
  ON public.virtual_queue (barbershop_id, barber_id)
  WHERE barber_id IS NOT NULL
    AND status IN ('in_progress', 'in_chair');
