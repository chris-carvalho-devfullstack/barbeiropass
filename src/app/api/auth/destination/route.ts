import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { resolvePortalDestination } from "@/utils/auth/portal-destination";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
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
      console.error("[AUTH_DESTINATION_LOOKUP_ERROR]", {
        membershipError: membershipResult.error,
        staffError: staffResult.error,
      });
      return NextResponse.json(
        { error: "Não foi possível verificar suas permissões. Tente novamente." },
        { status: 500 },
      );
    }

    const destination = resolvePortalDestination(
      (membershipResult.data ?? []).map((membership) => membership.role),
      (staffResult.data ?? []).map((staff) => ({
        role: staff.role,
        is_active: staff.is_active,
      })),
    );

    return NextResponse.json({ destination }, { status: 200 });
  } catch (error: unknown) {
    console.error("[AUTH_DESTINATION_FATAL_ERROR]", error);
    return NextResponse.json(
      { error: "Erro interno ao determinar a área de acesso." },
      { status: 500 },
    );
  }
}
