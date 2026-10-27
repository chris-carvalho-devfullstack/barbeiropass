import { getProfessionalContext } from "@/utils/professional/get-professional-context";
import { ProfessionalPortalShell } from "@/components/profissional/professional-portal-shell";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export default async function ProfessionalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { staff, barbershop } = await getProfessionalContext();

  return (
    <ProfessionalPortalShell
      fullName={staff.full_name}
      avatarUrl={staff.avatar_url}
      barbershopName={barbershop.name || "Sua barbearia"}
      barbershopSlug={barbershop.slug}
    >
      {children}
    </ProfessionalPortalShell>
  );
}
