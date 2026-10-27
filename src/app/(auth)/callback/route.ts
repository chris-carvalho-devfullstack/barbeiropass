import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { resolvePortalDestination } from "@/utils/auth/portal-destination";

export const runtime = "edge";
export const dynamic = "force-dynamic";

function safeLocalNext(next: string | null, origin: string): string {
  if (!next) return "/";

  try {
    const parsed = new URL(next, origin);
    if (parsed.origin !== origin) return "/";
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return "/";
  }
}

function redirectToPath(path: string, origin: string) {
  return NextResponse.redirect(new URL(path, origin));
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const rawNext = requestUrl.searchParams.get("next");

  if (!code) {
    return redirectToPath("/login?error=auth_failed", requestUrl.origin);
  }

  const supabase = await createServerClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("[AUTH_CALLBACK_EXCHANGE_ERROR]", exchangeError.message);
    return redirectToPath("/login?error=auth_failed", requestUrl.origin);
  }

  let finalRedirectUrl = safeLocalNext(rawNext, requestUrl.origin);

  // Mantém o fluxo existente que vincula um ticket público da fila à conta criada.
  if (rawNext?.includes("link_queue=")) {
    const nextUrlObj = new URL(finalRedirectUrl, requestUrl.origin);
    const queueId = nextUrlObj.searchParams.get("link_queue");

    if (queueId) {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (user && !userError) {
        const supabaseAdmin = createAdminClient();
        const { data: queueTicket, error: queueLookupError } = await supabaseAdmin
          .from("virtual_queue")
          .select("id, client_id, barbershop_id, client_auth_id")
          .eq("id", queueId)
          .maybeSingle();

        if (queueLookupError) {
          console.error("[PLG CONVERSION ERROR] Falha ao localizar ticket:", queueLookupError);
        } else if (queueTicket && !queueTicket.client_auth_id) {
          if (queueTicket.client_id) {
            const { error: customerUpdateError } = await supabaseAdmin
              .from("clientes")
              .update({ auth_user_id: user.id })
              .eq("id", queueTicket.client_id)
              .eq("barbershop_id", queueTicket.barbershop_id)
              .is("auth_user_id", null);

            if (customerUpdateError) {
              console.error("[PLG CONVERSION ERROR] Falha ao vincular cliente:", customerUpdateError);
            }
          }

          const { error: queueUpdateError } = await supabaseAdmin
            .from("virtual_queue")
            .update({ client_auth_id: user.id })
            .eq("id", queueId)
            .eq("barbershop_id", queueTicket.barbershop_id)
            .is("client_auth_id", null);

          if (queueUpdateError) {
            console.error("[PLG CONVERSION ERROR] Falha ao vincular ticket:", queueUpdateError);
          }
        }
      }

      nextUrlObj.searchParams.delete("link_queue");
      finalRedirectUrl = `${nextUrlObj.pathname}${nextUrlObj.search}`;
    }
  }

  // Preserva o destino público da barbearia nos fluxos de autenticação de clientes.
  if (finalRedirectUrl.startsWith("/b/")) {
    return redirectToPath(finalRedirectUrl, requestUrl.origin);
  }

  // Quando o fluxo de login OAuth é iniciado durante a aceitação de convite,
  // devolve o usuário à página pública; a API continua validando o e-mail do convite.
  if (finalRedirectUrl === "/convite/profissional/aceitar" || finalRedirectUrl.startsWith("/convite/profissional/aceitar?")) {
    return redirectToPath(finalRedirectUrl, requestUrl.origin);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return redirectToPath("/login?error=auth_failed", requestUrl.origin);
  }

  const [membershipResult, staffResult] = await Promise.all([
    supabase
      .from("barbershop_members")
      .select("role")
      .eq("profile_id", user.id),
    supabase
      .from("staff")
      .select("role, is_active")
      .eq("profile_id", user.id),
  ]);

  if (membershipResult.error || staffResult.error) {
    console.error("[AUTH_CALLBACK_ROLE_LOOKUP_ERROR]", {
      membershipError: membershipResult.error,
      staffError: staffResult.error,
    });
    return redirectToPath("/acesso-negado?reason=authorization_check_failed", requestUrl.origin);
  }

  const memberRoles = (membershipResult.data ?? []).map((membership) => membership.role);
  const staffRecords = (staffResult.data ?? []).map((staff) => ({
    role: staff.role,
    is_active: staff.is_active,
  }));

  // Um onboarding de proprietário deve ser explícito; a ausência de vínculo
  // não basta para transformar um cliente em proprietário de barbearia.
  if (
    finalRedirectUrl === "/cadastro/barbearia" &&
    memberRoles.length === 0 &&
    staffRecords.length === 0
  ) {
    return redirectToPath("/cadastro/barbearia", requestUrl.origin);
  }

  const destination = resolvePortalDestination(memberRoles, staffRecords);
  return redirectToPath(destination, requestUrl.origin);
}
