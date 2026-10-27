export type StaffAccessRecord = {
  role: string;
  is_active: boolean | null;
};

export type PortalDestination =
  | "/dashboard"
  | "/profissional"
  | "/agendar"
  | "/acesso-negado";

/**
 * Resolve a área após autenticação com base nos vínculos persistidos no banco.
 * A existência de uma sessão, por si só, nunca concede acesso administrativo.
 */
export function resolvePortalDestination(
  memberRoles: readonly string[],
  staffRecords: readonly StaffAccessRecord[],
): PortalDestination {
  if (memberRoles.some((role) => role === "owner" || role === "manager")) {
    return "/dashboard";
  }

  if (staffRecords.some((staff) => staff.role === "barber" && staff.is_active === true)) {
    return "/profissional";
  }

  const hasRestrictedStaffRole = staffRecords.some(
    (staff) => staff.role === "owner" || staff.role === "manager" || staff.role === "receptionist",
  );
  const hasRestrictedMembership = memberRoles.some(
    (role) => role === "barber" || role === "receptionist",
  );

  if (hasRestrictedStaffRole || hasRestrictedMembership) {
    return "/acesso-negado";
  }

  // Usuários sem papel administrativo/profissional ficam no fluxo de cliente,
  // em vez de serem enviados ao painel ou ao onboarding de uma barbearia.
  return "/agendar";
}
