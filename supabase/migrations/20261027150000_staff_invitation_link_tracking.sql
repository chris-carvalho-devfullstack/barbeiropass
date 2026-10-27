-- BarbeiroPass: rastreia a identidade Auth criada para cada convite e o tipo do link.
-- Esta migration é aditiva; execute após 20261027140000_staff_invitations.sql.

ALTER TABLE public.staff_invitations
    ADD COLUMN IF NOT EXISTS auth_user_id UUID
        REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.staff_invitations
    ADD COLUMN IF NOT EXISTS link_type TEXT NOT NULL DEFAULT 'invite';

DO $migration$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.staff_invitations'::regclass
          AND conname = 'staff_invitations_link_type_check'
    ) THEN
        ALTER TABLE public.staff_invitations
            ADD CONSTRAINT staff_invitations_link_type_check
            CHECK (link_type IN ('invite', 'magiclink'));
    END IF;
END;
$migration$;

CREATE INDEX IF NOT EXISTS staff_invitations_auth_user_id_idx
    ON public.staff_invitations (auth_user_id);

COMMENT ON COLUMN public.staff_invitations.auth_user_id IS
    'Usuário Auth criado ou associado ao link; não contém token de autenticação.';
COMMENT ON COLUMN public.staff_invitations.link_type IS
    'Tipo de verificação usado pelo link customizado: invite ou magiclink.';
