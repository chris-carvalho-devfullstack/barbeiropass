import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { resolvePortalDestination } from "@/utils/auth/portal-destination";

export async function getProfessionalContext() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const [membershipResult, staffResult] = await Promise.all([
    supabase
      .from("barbershop_members")
      .select("barbershop_id, role")
      .eq("profile_id", user.id),
    supabase
      .from("staff")
      .select("id, full_name, role, is_active, barbershop_id, avatar_url")
      .eq("profile_id", user.id),
  ]);

  if (membershipResult.error || staffResult.error) {
    console.error("[PROFESSIONAL_CONTEXT_LOOKUP_ERROR]", {
      membershipError: membershipResult.error,
      staffError: staffResult.error,
    });
    redirect("/acesso-negado?reason=professional_context_check_failed");
  }

  const memberships = membershipResult.data ?? [];
  const staffRecords = staffResult.data ?? [];
  const destination = resolvePortalDestination(
    memberships.map((membership) => membership.role),
    staffRecords.map((staff) => ({
      role: staff.role,
      is_active: staff.is_active,
    })),
  );

  if (destination !== "/profissional") {
    redirect(destination);
  }

  const eligibleStaff = staffRecords.filter((staff) =>
    staff.role === "barber" &&
    staff.is_active === true &&
    memberships.some((membership) =>
      membership.barbershop_id === staff.barbershop_id &&
      membership.role === "barber"
    )
  );

  if (eligibleStaff.length !== 1) {
    console.error("[PROFESSIONAL_CONTEXT_INVALID_STAFF_COUNT]", {
      userId: user.id,
      activeEligibleStaffCount: eligibleStaff.length,
    });
    redirect("/acesso-negado?reason=professional_profile_missing_or_ambiguous");
  }

  const staff = eligibleStaff[0];
  const { data: barbershop, error: barbershopError } = await supabase
    .from("barbershops")
    .select("id, name, slug, logo_url")
    .eq("id", staff.barbershop_id)
    .maybeSingle();

  if (barbershopError || !barbershop) {
    console.error("[PROFESSIONAL_BARBERSHOP_LOOKUP_ERROR]", barbershopError);
    redirect("/acesso-negado?reason=professional_barbershop_not_found");
  }

  return {
    supabase,
    user,
    staff,
    barbershop,
  };
}
