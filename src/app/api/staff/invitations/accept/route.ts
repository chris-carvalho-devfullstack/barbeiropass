import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "edge";

const invitationIdSchema = z.string().uuid("ID do convite inválido.");
const INVITABLE_STAFF_ROLES = new Set(["barber", "manager", "receptionist"]);

interface InvitationRecord {
  id: string;
  barbershop_id: string;
  staff_id: string;
  invited_email: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  expires_at: string;
  accepted_profile_id: string | null;
}

interface StaffRecord {
  id: string;
  barbershop_id: string;
  profile_id: string | null;
  role: string;
  is_active: boolean | null;
}

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      response: NextResponse.json(
        { error: "Sua sessão não está autenticada. Abra novamente o link recebido." },
        { status: 401 }
      ),
    };
  }

  return { supabase, user };
}

/**
 * GET valida que a sessão autenticada corresponde ao e-mail do convite.
 * Não revela o e-mail convidado nem outros dados do profissional.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const invitationIdResult = invitationIdSchema.safeParse(
      searchParams.get("invitationId")
    );

    if (!invitationIdResult.success) {
      return NextResponse.json(
        { error: "Informe um ID de convite válido." },
        { status: 400 }
      );
    }

    const authResult = await getAuthenticatedUser();
    if ("response" in authResult) return authResult.response;

    const { user } = authResult;
    const email = user.email?.trim().toLowerCase();

    if (!email || !user.email_confirmed_at) {
      return NextResponse.json(
        { error: "O e-mail da conta precisa ser confirmado para continuar." },
        { status: 403 }
      );
    }

    const adminClient = createAdminClient();
    const { data: invitationData, error: invitationError } = await adminClient
      .from("staff_invitations")
      .select(
        "id, barbershop_id, staff_id, invited_email, status, expires_at, accepted_profile_id"
      )
      .eq("id", invitationIdResult.data)
      .maybeSingle();

    if (invitationError) {
      console.error("[STAFF_INVITATION_VALIDATE_LOOKUP_ERROR]", invitationError);
      return NextResponse.json(
        { error: "Não foi possível validar este convite agora." },
        { status: 500 }
      );
    }

    if (!invitationData) {
      return NextResponse.json(
        { error: "Convite não encontrado ou indisponível." },
        { status: 404 }
      );
    }

    const invitation = invitationData as InvitationRecord;

    if (invitation.status === "accepted") {
      if (invitation.accepted_profile_id === user.id) {
        return NextResponse.json(
          { valid: true, status: "accepted", alreadyAccepted: true },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { error: "Este convite já foi aceito por outra conta." },
        { status: 409 }
      );
    }

    if (invitation.status !== "pending") {
      return NextResponse.json(
        {
          error:
            invitation.status === "expired"
              ? "Este convite expirou. Solicite um novo link ao administrador."
              : "Este convite foi revogado e não pode mais ser utilizado.",
          status: invitation.status,
        },
        { status: invitation.status === "expired" ? 410 : 409 }
      );
    }

    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      const now = new Date().toISOString();
      const { error: expiryError } = await adminClient
        .from("staff_invitations")
        .update({ status: "expired", updated_at: now })
        .eq("id", invitation.id)
        .eq("status", "pending");

      if (expiryError) {
        console.error("[STAFF_INVITATION_VALIDATE_EXPIRY_ERROR]", expiryError);
      }

      return NextResponse.json(
        {
          error: "Este convite expirou. Solicite um novo link ao administrador.",
          status: "expired",
        },
        { status: 410 }
      );
    }

    if (invitation.invited_email.trim().toLowerCase() !== email) {
      return NextResponse.json(
        { error: "A conta autenticada não corresponde ao e-mail deste convite." },
        { status: 403 }
      );
    }

    const { data: staffData, error: staffError } = await adminClient
      .from("staff")
      .select("id, barbershop_id, profile_id, role, is_active")
      .eq("id", invitation.staff_id)
      .eq("barbershop_id", invitation.barbershop_id)
      .maybeSingle();

    if (staffError) {
      console.error("[STAFF_INVITATION_VALIDATE_STAFF_ERROR]", staffError);
      return NextResponse.json(
        { error: "Não foi possível validar o cadastro profissional." },
        { status: 500 }
      );
    }

    if (!staffData) {
      return NextResponse.json(
        { error: "O cadastro profissional associado ao convite não foi encontrado." },
        { status: 404 }
      );
    }

    const staff = staffData as StaffRecord;

    if (staff.is_active !== true || !INVITABLE_STAFF_ROLES.has(staff.role)) {
      return NextResponse.json(
        { error: "Este cadastro profissional não está habilitado para ativação." },
        { status: 409 }
      );
    }

    if (staff.profile_id && staff.profile_id !== user.id) {
      return NextResponse.json(
        { error: "Este cadastro profissional já está vinculado a outra conta." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { valid: true, status: "pending", alreadyAccepted: false },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("[STAFF_INVITATION_VALIDATE_FATAL_ERROR]", error);
    return NextResponse.json(
      { error: "Erro interno ao validar o convite." },
      { status: 500 }
    );
  }
}

/** Conclui o vínculo usando a função SQL transacional e a sessão autenticada. */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const bodyResult = z
      .object({ invitationId: invitationIdSchema })
      .safeParse(body);

    if (!bodyResult.success) {
      return NextResponse.json(
        { error: "Informe um ID de convite válido." },
        { status: 400 }
      );
    }

    const authResult = await getAuthenticatedUser();
    if ("response" in authResult) return authResult.response;

    const { data, error } = await authResult.supabase.rpc(
      "accept_staff_invitation",
      { p_invitation_id: bodyResult.data.invitationId }
    );

    if (error) {
      // Erros de regra de negócio da função SQL usam P0001.
      if (error.code === "P0001") {
        return NextResponse.json(
          { error: error.message },
          { status: 409 }
        );
      }

      console.error("[STAFF_INVITATION_ACCEPT_RPC_ERROR]", error);
      return NextResponse.json(
        { error: "Não foi possível concluir a ativação. Tente novamente." },
        { status: 500 }
      );
    }

    const result = data as
      | {
          success?: boolean;
          status?: string;
          message?: string;
          already_accepted?: boolean;
          staff_id?: string;
          barbershop_id?: string;
        }
      | null;

    if (result?.success !== true) {
      const resultStatus = result?.status ?? "unavailable";
      const httpStatus = resultStatus === "expired" ? 410 : 409;

      return NextResponse.json(
        {
          error:
            result?.message ??
            "Este convite não está mais disponível. Solicite um novo link ao administrador.",
          status: resultStatus,
        },
        { status: httpStatus }
      );
    }

    return NextResponse.json(
      {
        success: true,
        status: "accepted",
        alreadyAccepted: result.already_accepted === true,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("[STAFF_INVITATION_ACCEPT_FATAL_ERROR]", error);
    return NextResponse.json(
      { error: "Erro interno ao concluir a ativação." },
      { status: 500 }
    );
  }
}
