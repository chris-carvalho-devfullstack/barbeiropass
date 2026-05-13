import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Award, Scissors, Star, Rocket, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default async function ConquistasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // 1. Busca a barbearia do utilizador
  const { data: member } = await supabase
    .from("barbershop_members")
    .select("barbershop_id")
    .eq("profile_id", user.id)
    .single();

  const barbershopId = member?.barbershop_id;

  // 2. Busca as conquistas já desbloqueadas no banco
  const { data: unlockedBadges } = await supabase
    .from("barbershop_achievements")
    .select("badge_type, unlocked_at")
    .eq("barbershop_id", barbershopId);

  const unlockedTypes = unlockedBadges?.map(b => b.badge_type) || [];

  // 3. Definição de todos os troféus possíveis da plataforma
  const allBadges = [
    {
      id: "PERFIL_OURO",
      title: "Perfil Ouro",
      description: "Atingiu 100% de preenchimento do perfil.",
      icon: Award,
      color: "text-yellow-500",
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/20",
    },
    {
      id: "PRIMEIRO_CORTE",
      title: "Primeiro Corte",
      description: "Realizou o primeiro agendamento ou venda no sistema.",
      icon: Scissors,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
    },
    {
      id: "SUPER_BARBEARIA",
      title: "Super Barbearia",
      description: "Recebeu 10 avaliações de 5 estrelas dos clientes.",
      icon: Star,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20",
    },
    {
      id: "PIONEIRO",
      title: "Pioneiro",
      description: "Uma das primeiras 50 barbearias a acreditar no BarberPass.",
      icon: Rocket,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
      border: "border-orange-500/20",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Galeria de Conquistas</h1>
        <p className="text-muted-foreground mt-2">
          Desbloqueie troféus e ganhe destaque exclusivo no nosso marketplace.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {allBadges.map((badge) => {
          const isUnlocked = unlockedTypes.includes(badge.id);
          const Icon = isUnlocked ? badge.icon : Lock;

          return (
            <Card 
              key={badge.id} 
              className={`relative overflow-hidden transition-all duration-500 ${
                isUnlocked 
                ? `border-2 ${badge.border} shadow-md` 
                : "opacity-60 grayscale border-zinc-200 shadow-none"
              }`}
            >
              {isUnlocked && (
                <div className={`absolute top-0 right-0 w-16 h-16 -mr-8 -mt-8 rotate-45 ${badge.bg}`} />
              )}
              
              <CardContent className="pt-8 pb-6 flex flex-col items-center text-center space-y-4">
                <div className={`p-4 rounded-2xl ${isUnlocked ? badge.bg : "bg-zinc-100"}`}>
                  <Icon className={isUnlocked ? badge.color : "text-zinc-400"} size={40} />
                </div>
                
                <div className="space-y-1">
                  <h3 className={`font-bold ${isUnlocked ? "text-zinc-900" : "text-zinc-500"}`}>
                    {badge.title}
                  </h3>
                  <p className="text-xs text-muted-foreground px-2">
                    {badge.description}
                  </p>
                </div>

                {isUnlocked ? (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Conquistado
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-zinc-100 text-zinc-500">
                    Bloqueado
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* FOOTER DA PÁGINA */}
      <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center bg-zinc-50/50">
        <p className="text-sm text-muted-foreground italic">
          &quot;Barbearias com o selo de Perfil Ouro e Super Barbearia têm 3x mais chances de serem escolhidas por novos clientes.&quot;
        </p>
      </div>
    </div>
  );
}