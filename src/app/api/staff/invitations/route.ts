import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "edge";

const staffIdSchema = z.string().uuid("ID do profissional inválido.");

const createInvitationSchema = z.object({
  staffId: z.string().uuid("ID do profissional inválido."),
  email: z.string().trim().email("Informe um e-mail válido.").transform((email) => email.toLowerCase()),
});

const ADMIN_ROLES = new Set(["owner", "manager"]);
const INVITABLE_STAFF_ROLES = new Set(["barber", "manager", "receptionist"]);

type InvitationLinkType = "invite" | "magiclink";

interface StaffRecord {
  id: string;
  barbershop_id: string;
  profile_id: string | null;
  role: string;
  full_name: string;
  is_active: boolean | null;
}

interface InvitationRecord {
  id: string;
  invited_email: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  expires_at: string;
  auth_user_id: string | null;
  link_type: InvitationLinkType;
}

function getInvitationTtlSeconds(): number {
  const rawValue = process.env.STAFF_INVITATION_TTL_SECONDS;

  // O padrão de uma hora precisa permanecer alinhado à configuração
  // Email OTP Expiration do Supabase Auth.
  if (!rawValue) return 3600;

  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value < 60 || value > 86400) {
    throw new Error(
      "STAFF_INVITATION_TTL_SECONDS deve ser um número inteiro entre 60 e 86400 e precisa corresponder à validade configurada no Supabase Auth."
    );
  }

  return value;
}

function isExistingUserError(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes("already registered") ||
    normalizedMessage.includes("already been registered") ||
    normalizedMessage.includes("already exists") ||
    normalizedMessage.includes("user already") ||
    normalizedMessage.includes("already has been registered")
  );
}

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      response: NextResponse.json({ error: "Não autorizado." }, { status: 401 }),
    };
  }

  return { supabase, user };
}

async function getAuthorizedStaff(
  staffId: string,
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  adminClient: ReturnType<typeof createAdminClient>
): Promise<
  | { staff: StaffRecord; errorResponse: null }
  | { staff: null; errorResponse: NextResponse }
> {
  const { data: staffData, error: staffError } = await adminClient
    .from("staff")
    .select("id, barbershop_id, profile_id, role, full_name, is_active")
    .eq("id", staffId)
    .maybeSingle();

  if (staffError) {
    console.error("[STAFF_INVITATION_STAFF_LOOKUP_ERROR]", staffError);
    return {
      staff: null,
      errorResponse: NextResponse.json(
        { error: "Não foi possível consultar o cadastro do profissional." },
        { status: 500 }
      ),
    };
  }

  if (!staffData) {
    return {
      staff: null,
      errorResponse: NextResponse.json(
        { error: "Profissional não encontrado ou acesso negado." },
        { status: 404 }
      ),
    };
  }

  const staff = staffData as StaffRecord;
  const { data: membership, error: membershipError } = await supabase
    .from("barbershop_members")
    .select("role")
    .eq("barbershop_id", staff.barbershop_id)
    .eq("profile_id", userId)
    .maybeSingle();

  if (membershipError) {
    console.error("[STAFF_INVITATION_MEMBERSHIP_LOOKUP_ERROR]", membershipError);
    return {
      staff: null,
      errorResponse: NextResponse.json(
        { error: "Não foi possível verificar as permissões da barbearia." },
        { status: 500 }
      ),
    };
  }

  if (!membership) {
    // Resposta indistinguível para IDs inexistentes e registros de outra barbearia.
    return {
      staff: null,
      errorResponse: NextResponse.json(
        { error: "Profissional não encontrado ou acesso negado." },
        { status: 404 }
      ),
    };
  }

  if (!ADMIN_ROLES.has(membership.role)) {
    return {
      staff: null,
      errorResponse: NextResponse.json(
        { error: "Apenas proprietários ou gerentes desta barbearia podem administrar convites." },
        { status: 403 }
      ),
    };
  }

  return { staff, errorResponse: null };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const staffIdResult = staffIdSchema.safeParse(searchParams.get("staffId"));

    if (!staffIdResult.success) {
      return NextResponse.json(
        { error: "Informe um ID de profissional válido no parâmetro staffId." },
        { status: 400 }
      );
    }

    const authResult = await getAuthenticatedUser();
    if ("response" in authResult) return authResult.response;

    const adminClient = createAdminClient();
    const staffAccess = await getAuthorizedStaff(
      staffIdResult.data,
      authResult.user.id,
      authResult.supabase,
      adminClient
    );

    if (staffAccess.errorResponse) return staffAccess.errorResponse;

    const now = new Date().toISOString();
    const { error: expiryError } = await adminClient
      .from("staff_invitations")
      .update({ status: "expired", updated_at: now })
      .eq("staff_id", staffAccess.staff.id)
      .eq("status", "pending")
      .lte("expires_at", now);

    if (expiryError) {
      console.error("[STAFF_INVITATION_EXPIRY_UPDATE_ERROR]", expiryError);
      return NextResponse.json(
        { error: "Não foi possível atualizar o estado dos convites expirados." },
        { status: 500 }
      );
    }

    const { data: invitations, error: invitationsError } = await adminClient
      .from("staff_invitations")
      .select(
        "id, invited_email, status, expires_at, accepted_at, revoked_at, created_at, updated_at, link_type"
      )
      .eq("staff_id", staffAccess.staff.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (invitationsError) {
      console.error("[STAFF_INVITATION_LIST_ERROR]", invitationsError);
      return NextResponse.json(
        { error: "Não foi possível consultar os convites deste profissional." },
        { status: 500 }
      );
    }

    // Nunca retornamos auth_user_id, token_hash, OTP ou link anteriormente gerado.
    return NextResponse.json({ invitations: invitations ?? [] }, { status: 200 });
  } catch (error: unknown) {
    console.error("[STAFF_INVITATION_GET_FATAL_ERROR]", error);
    return NextResponse.json(
      { error: "Erro interno ao consultar os convites." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.json().catch(() => null);
    const bodyResult = createInvitationSchema.safeParse(rawBody);

    if (!bodyResult.success) {
      return NextResponse.json(
        { error: "Dados inválidos.", details: bodyResult.error.flatten() },
        { status: 400 }
      );
    }

    const authResult = await getAuthenticatedUser();
    if ("response" in authResult) return authResult.response;

    const adminClient = createAdminClient();
    const staffAccess = await getAuthorizedStaff(
      bodyResult.data.staffId,
      authResult.user.id,
      authResult.supabase,
      adminClient
    );

    if (staffAccess.errorResponse) return staffAccess.errorResponse;

    const staff = staffAccess.staff;

    if (staff.is_active !== true) {
      return NextResponse.json(
        { error: "Não é possível convidar um profissional inativo." },
        { status: 409 }
      );
    }

    if (!INVITABLE_STAFF_ROLES.has(staff.role)) {
      return NextResponse.json(
        { error: "O cargo deste cadastro não pode receber convite para a área profissional." },
        { status: 400 }
      );
    }

    if (staff.profile_id) {
      return NextResponse.json(
        { error: "Este profissional já está vinculado a uma conta. Não é necessário gerar outro convite." },
        { status: 409 }
      );
    }

    const email = bodyResult.data.email;
    const nowDate = new Date();
    const now = nowDate.toISOString();

    const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    let siteUrl: string;
    try {
      const parsedSiteUrl = new URL(configuredSiteUrl || new URL(request.url).origin);
      if (parsedSiteUrl.protocol !== "https:" && parsedSiteUrl.protocol !== "http:") {
        throw new Error("Protocolo inválido para a URL pública do aplicativo.");
      }
      siteUrl = parsedSiteUrl.origin;
    } catch (siteUrlError) {
      console.error("[STAFF_INVITATION_SITE_URL_ERROR]", siteUrlError);
      return NextResponse.json(
        { error: "A URL pública do aplicativo está configurada incorretamente." },
        { status: 500 }
      );
    }

    const { data: latestInvitationData, error: latestInvitationError } = await adminClient
      .from("staff_invitations")
      .select("id, invited_email, status, expires_at, auth_user_id, link_type")
      .eq("staff_id", staff.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestInvitationError) {
      console.error("[STAFF_INVITATION_PREVIOUS_LOOKUP_ERROR]", latestInvitationError);
      return NextResponse.json(
        { error: "Não foi possível consultar o histórico de convites." },
        { status: 500 }
      );
    }

    let latestInvitation = (latestInvitationData as InvitationRecord | null) ?? null;

    if (latestInvitation?.status === "accepted") {
      return NextResponse.json(
        { error: "Este cadastro já possui um convite aceito. Verifique o vínculo da conta antes de emitir outro." },
        { status: 409 }
      );
    }

    if (
      latestInvitation?.status === "pending" &&
      new Date(latestInvitation.expires_at).getTime() <= nowDate.getTime()
    ) {
      const { error: expirePreviousError } = await adminClient
        .from("staff_invitations")
        .update({ status: "expired", updated_at: now })
        .eq("id", latestInvitation.id)
        .eq("status", "pending");

      if (expirePreviousError) {
        console.error("[STAFF_INVITATION_EXPIRE_PREVIOUS_ERROR]", expirePreviousError);
        return NextResponse.json(
          { error: "Não foi possível atualizar o convite anterior expirado." },
          { status: 500 }
        );
      }

      latestInvitation = { ...latestInvitation, status: "expired" };
    }

    const reusePendingInvitation = latestInvitation?.status === "pending";

const invitationId =
  latestInvitation?.status === "pending"
    ? latestInvitation.id
    : crypto.randomUUID();
    const canUseMagicLink =
      latestInvitation?.auth_user_id != null &&
      latestInvitation.invited_email === email;

    let ttlSeconds: number;
    try {
      ttlSeconds = getInvitationTtlSeconds();
    } catch (configurationError) {
      console.error("[STAFF_INVITATION_TTL_CONFIGURATION_ERROR]", configurationError);
      return NextResponse.json(
        { error: "A validade dos convites está configurada incorretamente no servidor." },
        { status: 500 }
      );
    }

    let linkType: InvitationLinkType = canUseMagicLink ? "magiclink" : "invite";
    // Começamos a contar a validade antes da chamada de geração. Isso evita
    // que a validade mostrada ultrapasse, mesmo ligeiramente, a do token real.
    const tokenGenerationStartTime = Date.now();
    let generatedLink = await adminClient.auth.admin.generateLink({
      type: linkType,
      email,
      options: {
        data: { full_name: staff.full_name },
      },
    });

    if (
      generatedLink.error &&
      linkType === "invite" &&
      isExistingUserError(generatedLink.error.message)
    ) {
      // Se o e-mail já pertence a uma conta, gera um link de acesso para ela.
      // A aceitação posterior ainda exigirá correspondência com o e-mail convidado,
      // vínculo ao profissional correto e validação do papel no banco.
      linkType = "magiclink";
      generatedLink = await adminClient.auth.admin.generateLink({
        type: linkType,
        email,
        options: {
          data: { full_name: staff.full_name },
        },
      });
    }

    if (generatedLink.error || !generatedLink.data?.user?.id) {
      console.error(
        "[STAFF_INVITATION_GENERATE_LINK_ERROR]",
        generatedLink.error
      );
      return NextResponse.json(
        {
          error: "Não foi possível gerar o link. Verifique se o e-mail já possui uma conta e tente novamente.",
        },
        { status: 400 }
      );
    }

    const tokenHash = generatedLink.data.properties?.hashed_token;
    if (!tokenHash) {
      console.error("[STAFF_INVITATION_HASH_MISSING]", {
        invitationId,
        linkType,
      });
      return NextResponse.json(
        { error: "O provedor de autenticação não retornou o token necessário para criar o link." },
        { status: 502 }
      );
    }

    const expiresAt = new Date(tokenGenerationStartTime + ttlSeconds * 1000).toISOString();
    const invitationPayload = {
      barbershop_id: staff.barbershop_id,
      staff_id: staff.id,
      invited_email: email,
      invited_by_profile_id: authResult.user.id,
      status: "pending",
      expires_at: expiresAt,
      accepted_at: null,
      accepted_profile_id: null,
      revoked_at: null,
      auth_user_id: generatedLink.data.user.id,
      link_type: linkType,
      created_at: now,
      updated_at: now,
    };

    let saveError: { message: string } | null = null;

    if (reusePendingInvitation) {
      const { error } = await adminClient
        .from("staff_invitations")
        .update(invitationPayload)
        .eq("id", invitationId);
      saveError = error;
    } else {
      const { error } = await adminClient
        .from("staff_invitations")
        .insert({ id: invitationId, ...invitationPayload });
      saveError = error;
    }

    if (saveError) {
      console.error("[STAFF_INVITATION_SAVE_ERROR]", saveError);
      return NextResponse.json(
        { error: "O link foi gerado, mas não foi possível registrar o convite. Tente gerar novamente." },
        { status: 500 }
      );
    }

    const invitationUrl = new URL("/convite/profissional/aceitar", siteUrl);
    invitationUrl.searchParams.set("token_hash", tokenHash);
    invitationUrl.searchParams.set("type", linkType);
    invitationUrl.searchParams.set("invitation_id", invitationId);

    return NextResponse.json(
      {
        success: true,
        invitation: {
          id: invitationId,
          staffId: staff.id,
          invitedEmail: email,
          status: "pending",
          linkType,
          expiresAt,
          renewed: reusePendingInvitation,
        },
        invitationUrl: invitationUrl.toString(),
        message: reusePendingInvitation
          ? "Link de convite renovado. Copie e envie manualmente ao profissional."
          : "Convite gerado. Copie e envie manualmente ao profissional.",
      },
      { status: reusePendingInvitation ? 200 : 201 }
    );
  } catch (error: unknown) {
    console.error("[STAFF_INVITATION_POST_FATAL_ERROR]", error);
    return NextResponse.json(
      { error: "Erro interno ao gerar o convite." },
      { status: 500 }
    );
  }
}
