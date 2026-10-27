import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { resolvePortalDestination } from "@/utils/auth/portal-destination";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { UserNav } from "@/components/user-nav";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
      .select("role")
      .eq("profile_id", user.id),
    supabase
      .from("staff")
      .select("role, is_active")
      .eq("profile_id", user.id),
  ]);

  // Falha fechada: sem conseguir confirmar os papéis, não renderiza o painel.
  if (membershipResult.error || staffResult.error) {
    console.error("[DASHBOARD_AUTHORIZATION_ERROR]", {
      membershipError: membershipResult.error,
      staffError: staffResult.error,
    });
    redirect("/acesso-negado?reason=authorization_check_failed");
  }

  const destination = resolvePortalDestination(
    (membershipResult.data ?? []).map((membership) => membership.role),
    (staffResult.data ?? []).map((staff) => ({
      role: staff.role,
      is_active: staff.is_active,
    })),
  );

  if (destination !== "/dashboard") {
    redirect(destination);
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <AppSidebar />
        <main className="flex w-full flex-1 flex-col overflow-hidden">
          <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-4 border-b border-zinc-200 bg-white pl-4 pr-6 dark:border-zinc-800 dark:bg-zinc-900">
            <SidebarTrigger className="text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-50" />
            <div className="flex-1" />
            <UserNav />
          </header>
          <div className="flex-1 overflow-auto p-6">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
