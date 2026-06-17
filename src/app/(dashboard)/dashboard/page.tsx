import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Scissors, Users, Calendar, DollarSign } from "lucide-react";
import { OnboardingProgress } from "@/components/onboarding-progress";
import { OnboardingCelebration } from "@/components/onboarding-celebration";
import { OnboardingSuccessBanner } from "@/components/onboarding-success-banner"; // <-- NOVO IMPORT


export const runtime = "edge";
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  // 1. Pega o usuário logado
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 2. Busca os dados
  const { data: memberData, error: dbError } = await supabase
    .from("barbershop_members")
    .select(`
      role,
      barbershop_id,
      barbershops (
        id,
        name,
        slug,
        onboarding_score,
        description,
        logo_url
      )
    `)
    .eq("profile_id", user.id)
    .maybeSingle();

  if (dbError) {
    console.error("Erro do Supabase:", dbError);
    return (
      <div className="p-10 text-red-500 border border-red-200 bg-red-50 rounded-lg">
        <strong>Erro de Banco de Dados:</strong> {dbError.message}
      </div>
    );
  }

  if (!memberData || !memberData.barbershops) {
    redirect("/cadastro/barbearia");
  }

  const barbershopId = memberData.barbershop_id;
  const bData = memberData.barbershops;
  const barbershop = Array.isArray(bData) ? bData[0] : bData;

  const barbershopName = barbershop?.name || "Sua Barbearia";
  const score = barbershop?.onboarding_score ?? 30;

  // 3. Verificações reais de progresso
  const [
    { data: location },
    { count: hoursCount },
    { count: servicesCount }
  ] = await Promise.all([
    supabase.from("barbershop_locations").select("id").eq("barbershop_id", barbershopId).maybeSingle(),
    supabase.from("barbershop_business_hours").select("*", { count: 'exact', head: true }).eq("barbershop_id", barbershopId),
    supabase.from("services").select("*", { count: 'exact', head: true }).eq("barbershop_id", barbershopId),
  ]);

  const stepsCompleted = {
    hasAddress: !!location,
    hasHours: (hoursCount ?? 0) > 0,
    hasServices: (servicesCount ?? 0) > 0,
    hasAppearance: !!barbershop?.description || !!barbershop?.logo_url
  };

  return (
    <div className="space-y-8 animate-in fade-in zoom-in duration-500">
      
      {/* Gatilho invisível para os confetes e controle de localStorage */}
      <OnboardingCelebration score={score} />

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Bem-vindo ao painel de controle da <strong className="text-indigo-600">{barbershopName}</strong>.
        </p>
      </div>
 

      {/* Se o score é menor que 100, exibe tarefas. Se é 100, exibe o banner dispensável */}
      {score < 100 ? (
        <OnboardingProgress 
          score={score} 
          stepsCompleted={stepsCompleted} 
        />
      ) : (
        <OnboardingSuccessBanner />
      )}

      {/* Cards de Métricas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faturamento</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 0,00</div>
            <p className="text-xs text-muted-foreground">+0% em relação ao mês anterior</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agendamentos Hoje</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">0 aguardando confirmação</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes na Fila</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Tempo médio de espera: -- min</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Serviços Ativos</CardTitle>
            <Scissors className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{servicesCount ?? 0}</div>
            <p className="text-xs text-muted-foreground">Gerencie seu catálogo</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}