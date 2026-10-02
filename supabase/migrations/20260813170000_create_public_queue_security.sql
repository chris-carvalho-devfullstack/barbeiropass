-- Passo 1: tokens de posse de ticket e rate limit para endpoints pÃºblicos.
-- Esta migration nÃ£o altera as policies existentes: a interface ainda serÃ¡ migrada no Passo 2.

CREATE TABLE IF NOT EXISTS public.public_queue_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid NOT NULL UNIQUE REFERENCES public.virtual_queue(id) ON DELETE CASCADE,
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_queue_access_tokens_active
  ON public.public_queue_access_tokens (barbershop_id, expires_at)
  WHERE revoked_at IS NULL;

ALTER TABLE public.public_queue_access_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.public_queue_access_tokens FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.public_queue_access_tokens TO service_role;

CREATE TABLE IF NOT EXISTS public.public_rate_limits (
  scope text NOT NULL,
  subject_hash text NOT NULL CHECK (subject_hash ~ '^[0-9a-f]{64}$'),
  attempts integer NOT NULL CHECK (attempts > 0),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, subject_hash)
);

ALTER TABLE public.public_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.public_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.public_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_public_rate_limit(
  p_scope text,
  p_subject_hash text,
  p_max_attempts integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_attempts integer;
BEGIN
  IF p_scope = '' OR p_max_attempts < 1 OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'Invalid rate limit parameters';
  END IF;

  INSERT INTO public.public_rate_limits AS rate_limit (
    scope,
    subject_hash,
    attempts,
    window_started_at,
    updated_at
  )
  VALUES (p_scope, p_subject_hash, 1, now(), now())
  ON CONFLICT (scope, subject_hash) DO UPDATE
  SET
    attempts = CASE
      WHEN rate_limit.window_started_at <= now() - make_interval(secs => p_window_seconds)
        THEN 1
      ELSE rate_limit.attempts + 1
    END,
    window_started_at = CASE
      WHEN rate_limit.window_started_at <= now() - make_interval(secs => p_window_seconds)
        THEN now()
      ELSE rate_limit.window_started_at
    END,
    updated_at = now()
  RETURNING attempts INTO v_attempts;

  RETURN v_attempts <= p_max_attempts;
END;
$function$;

REVOKE ALL ON FUNCTION public.consume_public_rate_limit(text, text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_public_rate_limit(text, text, integer, integer)
  TO service_role;
