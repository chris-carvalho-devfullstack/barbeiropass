-- Evento público de Realtime da Fila Virtual.
--
-- Esta tabela NÃO armazena dados pessoais e NÃO replica os registros
-- da virtual_queue para o navegador.
--
-- O navegador público recebe somente um evento de alteração e,
-- após isso, consulta /api/public/queue/status, que valida o cookie
-- HttpOnly e devolve somente os dados necessários ao cliente.

CREATE TABLE IF NOT EXISTS public.public_queue_events (
  barbershop_id uuid PRIMARY KEY
    REFERENCES public.barbershops(id)
    ON DELETE CASCADE,
  changed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.public_queue_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.public_queue_events
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.public_queue_events
  TO anon, authenticated;

DROP POLICY IF EXISTS "Public queue events are readable"
  ON public.public_queue_events;

CREATE POLICY "Public queue events are readable"
  ON public.public_queue_events
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.notify_public_queue_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.public_queue_events (
      barbershop_id,
      changed_at
    )
    VALUES (
      OLD.barbershop_id,
      clock_timestamp()
    )
    ON CONFLICT (barbershop_id)
    DO UPDATE SET changed_at = EXCLUDED.changed_at;

    RETURN OLD;
  END IF;

  INSERT INTO public.public_queue_events (
    barbershop_id,
    changed_at
  )
  VALUES (
    NEW.barbershop_id,
    clock_timestamp()
  )
  ON CONFLICT (barbershop_id)
  DO UPDATE SET changed_at = EXCLUDED.changed_at;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.notify_public_queue_event()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.notify_public_queue_event()
  TO service_role;

DROP TRIGGER IF EXISTS trg_virtual_queue_public_realtime
  ON public.virtual_queue;

CREATE TRIGGER trg_virtual_queue_public_realtime
AFTER INSERT
   OR DELETE
   OR UPDATE OF
      status,
      joined_at,
      barber_id,
      barber_name,
      chair_number,
      client_auth_id,
      is_rated
ON public.virtual_queue
FOR EACH ROW
EXECUTE FUNCTION public.notify_public_queue_event();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'public_queue_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.public_queue_events;
  END IF;
END;
$$;