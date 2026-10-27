-- BarbeiroPass: convites de acesso para profissionais.
-- O link/token não é armazenado no banco. A aplicação o entrega ao administrador
-- apenas no momento de geração, para cópia e envio manual.

CREATE TABLE IF NOT EXISTS public.staff_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barbershop_id UUID NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    invited_email TEXT NOT NULL,
    invited_by_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    accepted_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT staff_invitations_email_normalized_check
        CHECK (invited_email = LOWER(BTRIM(invited_email))),
    CONSTRAINT staff_invitations_expiry_after_creation_check
        CHECK (expires_at > created_at),
    CONSTRAINT staff_invitations_accepted_at_check
        CHECK (status <> 'accepted' OR accepted_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS staff_invitations_barbershop_created_idx
    ON public.staff_invitations (barbershop_id, created_at DESC);

CREATE INDEX IF NOT EXISTS staff_invitations_staff_created_idx
    ON public.staff_invitations (staff_id, created_at DESC);

CREATE INDEX IF NOT EXISTS staff_invitations_email_idx
    ON public.staff_invitations (barbershop_id, invited_email);

-- Permite apenas um convite pendente por registro de profissional.
-- A rota de geração deve marcar convites pendentes vencidos como expired e
-- revogar o convite pendente anterior antes de inserir uma nova emissão.
CREATE UNIQUE INDEX IF NOT EXISTS staff_invitations_one_pending_per_staff_uidx
    ON public.staff_invitations (staff_id)
    WHERE status = 'pending';

-- A tabela é acessada pelas rotas do servidor usando createAdminClient().
-- Não concedemos acesso direto a clientes anon/authenticated.
ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.staff_invitations FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.staff_invitations TO service_role;

COMMENT ON TABLE public.staff_invitations IS
    'Controle de convites de acesso à área profissional. Tokens e links não são persistidos.';
COMMENT ON COLUMN public.staff_invitations.status IS
    'Estado do convite: pending, accepted, expired ou revoked.';
COMMENT ON COLUMN public.staff_invitations.expires_at IS
    'Data/hora de expiração correspondente à validade configurada para o link no Supabase Auth.';

-- Aceita um convite depois de a rota de confirmação ter validado o token_hash
-- e estabelecido a sessão autenticada. Faz o vínculo do profissional e a criação
-- do membro na mesma transação PostgreSQL.
CREATE OR REPLACE FUNCTION public.accept_staff_invitation(p_invitation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $function$
DECLARE
    v_user_id UUID;
    v_user_email TEXT;
    v_invitation public.staff_invitations%ROWTYPE;
    v_staff public.staff%ROWTYPE;
    v_member_role public.user_role;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'É necessário autenticar a conta para aceitar o convite.';
    END IF;

    SELECT LOWER(BTRIM(u.email))
    INTO v_user_email
    FROM auth.users AS u
    WHERE u.id = v_user_id
      AND u.email_confirmed_at IS NOT NULL;

    IF v_user_email IS NULL THEN
        RAISE EXCEPTION 'A conta precisa ter o e-mail confirmado para aceitar o convite.';
    END IF;

    SELECT si.*
    INTO v_invitation
    FROM public.staff_invitations AS si
    WHERE si.id = p_invitation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Convite não encontrado.';
    END IF;

    IF v_invitation.status = 'accepted' THEN
        IF v_invitation.accepted_profile_id = v_user_id THEN
            RETURN JSONB_BUILD_OBJECT(
                'success', TRUE,
                'status', 'accepted',
                'already_accepted', TRUE
            );
        END IF;

        RAISE EXCEPTION 'Este convite já foi aceito por outra conta.';
    END IF;

    IF v_invitation.status <> 'pending' THEN
        RETURN JSONB_BUILD_OBJECT(
            'success', FALSE,
            'status', v_invitation.status,
            'message', 'Este convite não está mais disponível.'
        );
    END IF;

    IF v_invitation.expires_at <= NOW() THEN
        UPDATE public.staff_invitations
        SET status = 'expired',
            updated_at = NOW()
        WHERE id = v_invitation.id;

        RETURN JSONB_BUILD_OBJECT(
            'success', FALSE,
            'status', 'expired',
            'message', 'Este convite expirou. Solicite um novo link ao administrador.'
        );
    END IF;

    IF v_invitation.invited_email <> v_user_email THEN
        RAISE EXCEPTION 'A conta autenticada não corresponde ao e-mail convidado.';
    END IF;

    SELECT s.*
    INTO v_staff
    FROM public.staff AS s
    WHERE s.id = v_invitation.staff_id
      AND s.barbershop_id = v_invitation.barbershop_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'O registro do profissional associado ao convite não foi encontrado.';
    END IF;

    IF v_staff.is_active IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'O cadastro deste profissional está inativo.';
    END IF;

    IF v_staff.role::TEXT NOT IN ('barber', 'manager', 'receptionist') THEN
        RAISE EXCEPTION 'O cargo deste registro não pode ser ativado por convite profissional.';
    END IF;

    IF v_staff.profile_id IS NOT NULL AND v_staff.profile_id <> v_user_id THEN
        RAISE EXCEPTION 'Este registro profissional já está vinculado a outra conta.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.staff AS other_staff
        WHERE other_staff.barbershop_id = v_invitation.barbershop_id
          AND other_staff.profile_id = v_user_id
          AND other_staff.id <> v_staff.id
    ) THEN
        RAISE EXCEPTION 'Esta conta já está vinculada a outro profissional nesta barbearia.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.id = v_user_id
    ) THEN
        RAISE EXCEPTION 'O perfil da conta não foi criado. Não foi possível concluir a ativação.';
    END IF;

    SELECT bm.role
    INTO v_member_role
    FROM public.barbershop_members AS bm
    WHERE bm.barbershop_id = v_invitation.barbershop_id
      AND bm.profile_id = v_user_id
    FOR UPDATE;

    IF FOUND THEN
        IF v_member_role::TEXT <> v_staff.role::TEXT THEN
            RAISE EXCEPTION 'Esta conta já possui outro papel nesta barbearia. A associação precisa ser revisada pelo administrador.';
        END IF;
    ELSE
        INSERT INTO public.barbershop_members (
            barbershop_id,
            profile_id,
            role
        )
        VALUES (
            v_invitation.barbershop_id,
            v_user_id,
            v_staff.role::TEXT::public.user_role
        );
    END IF;

    UPDATE public.staff
    SET profile_id = v_user_id,
        updated_at = NOW()
    WHERE id = v_staff.id
      AND barbershop_id = v_invitation.barbershop_id
      AND (profile_id IS NULL OR profile_id = v_user_id);

    UPDATE public.staff_invitations
    SET status = 'accepted',
        accepted_at = NOW(),
        accepted_profile_id = v_user_id,
        updated_at = NOW()
    WHERE id = v_invitation.id;

    RETURN JSONB_BUILD_OBJECT(
        'success', TRUE,
        'status', 'accepted',
        'staff_id', v_staff.id,
        'barbershop_id', v_invitation.barbershop_id
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.accept_staff_invitation(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_staff_invitation(UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.accept_staff_invitation(UUID) IS
    'Aceita um convite pendente após verificação Auth, confirma e-mail, confere o papel e vincula staff e barbershop_members atomicamente.';
