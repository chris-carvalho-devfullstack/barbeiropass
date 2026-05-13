import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Scissors, Users, Calendar, DollarSign } from "lucide-react";
import { OnboardingProgress } from "@/components/onboarding-progress";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  // 1. Pega o usuário logado
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 2. Busca os dados da Barbearia vinculada
  // Note que usamos o .single() para pegar apenas UM resultado
  const { data: memberData, error: dbError } = await supabase
    .from("barbershop_members")
    .select(`
      role,
      barbershops (
        name,
        slug,
        onboarding_score 
      )
    `)
    .eq("profile_id", user.id)
    .maybeSingle(); // Usamos maybeSingle para não quebrar se não encontrar nada

  // Se houver erro de banco, logamos no terminal para você ver
  if (dbError) {
    console.error("Erro do Supabase:", dbError);
    return (
      <div className="p-10 text-red-500 border border-red-200 bg-red-50 rounded-lg">
        <strong>Erro de Banco de Dados:</strong> {dbError.message}
        <p className="text-sm mt-2">Verifique as políticas de RLS no Supabase.</p>
      </div>
    );
  }

  // Se não houver vínculo com barbearia, redireciona para o cadastro da barbearia
  if (!memberData || !memberData.barbershops) {
    redirect("/cadastro/barbearia");
  }

  // 3. Extração segura dos dados (Lidando com o fato de barbershops poder vir como objeto ou array)
  const bData = memberData.barbershops;
  const barbershop = Array.isArray(bData) ? bData[0] : bData;

  const barbershopName = barbershop?.name || "Sua Barbearia";
  const score = barbershop?.onboarding_score ?? 30;

  // 4. Passos do Onboarding
  const onboardingSteps = [
    {
      id: "account",
      title: "Conta criada",
      description: "Informações básicas registradas",
      completed: true,
      href: "#",
    },
    {
      id: "location",
      title: "Endereço da Barbearia",
      description: "Onde seus clientes vão te encontrar?",
      completed: score >= 50,
      href: "/perfil/endereco", 
    },
    {
      id: "hours",
      title: "Horários de Funcionamento",
      description: "Dias e horários de atendimento",
      completed: score >= 70,
      href: "/perfil/horarios",
    },
    {
      id: "services",
      title: "Cadastrar Serviços",
      description: "Cortes, barba, pacotes e valores",
      completed: score >= 90,
      href: "/servicos",
    },
    {
      id: "photos",
      title: "Fotos e Descrição",
      description: "Atraia clientes com sua identidade visual",
      completed: score === 100,
      href: "/perfil/aparencia",
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in zoom-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Bem-vindo ao painel de controle da <strong className="text-indigo-600">{barbershopName}</strong>.
        </p>
      </div>

      <OnboardingProgress score={score} steps={onboardingSteps} />

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
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Gerencie seu catálogo</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}