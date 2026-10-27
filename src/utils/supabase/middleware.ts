import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { resolvePortalDestination } from "@/utils/auth/portal-destination";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setAll(cookiesToSet: any[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  const isPublicRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/cadastro") ||
    pathname.startsWith("/callback") ||
    pathname.startsWith("/b/") ||
    pathname.startsWith("/api/public/") ||
    pathname === "/api/auth/destination" ||
    pathname === "/convite/profissional/aceitar" ||
    pathname.startsWith("/convite/profissional/aceitar/") ||
    pathname.startsWith("/acesso-negado") ||
    pathname === "/";

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Acesso à página de login por uma sessão existente usa os papéis reais,
  // nunca um redirecionamento fixo para o dashboard administrativo.
  if (user && pathname.startsWith("/login")) {
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

    const destination =
      membershipResult.error || staffResult.error
        ? "/acesso-negado?reason=authorization_check_failed"
        : resolvePortalDestination(
            (membershipResult.data ?? []).map((membership) => membership.role),
            (staffResult.data ?? []).map((staff) => ({
              role: staff.role,
              is_active: staff.is_active,
            })),
          );

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = destination.split("?")[0];
    redirectUrl.search = destination.includes("?") ? `?${destination.split("?").slice(1).join("?")}` : "";

    const redirectResponse = NextResponse.redirect(redirectUrl);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  }

  return supabaseResponse;
}
