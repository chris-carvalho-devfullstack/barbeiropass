// src/app/(dashboard)/clientes/page.tsx
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import ClientManager from "./client-manager";

export const runtime = "edge";

interface ApptRaw {
  id: string;
  client_id: string;
  status: string;
  scheduled_at: string;
  appointment_services: { services: { name: string } | null }[] | null;
}

interface PosRaw {
  total_amount: number;
}

export default async function ClientesPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("barbershop_members")
    .select("barbershop_id")
    .eq("profile_id", user.id)
    .single();

  if (!member) redirect("/dashboard");

  const tenantId = member.barbershop_id;

  // 1. Busca Global Simultânea (Clientes, Agendamentos e Caixa)
  const [clientesRes, apptsRes, posRes] = await Promise.all([
    supabase.from("clientes").select("id, name, phone, email, status, created_at").eq("barbershop_id", tenantId).order("created_at", { ascending: false }),
    supabase.from("appointments").select("id, client_id, status, scheduled_at, appointment_services(services(name))").eq("barbershop_id", tenantId).order("scheduled_at", { ascending: true }),
    supabase.from("pos_orders").select("total_amount").eq("barbershop_id", tenantId)
  ]);

  const clientes = clientesRes.data || [];
  const agendamentos = (apptsRes.data as unknown as ApptRaw[]) || [];
  const vendas = (posRes.data as unknown as PosRaw[]) || [];

  // =======================================================================
  // 🧠 CÁLCULOS DO CENTRO NERVOSO (MACRO)
  // =======================================================================
  const hoje = new Date();
  
  // Agrupando agendamentos por cliente
  const apptsPorCliente: Record<string, ApptRaw[]> = {};
  agendamentos.forEach(a => {
    if (!apptsPorCliente[a.client_id]) apptsPorCliente[a.client_id] = [];
    apptsPorCliente[a.client_id].push(a);
  });

  let clientesAtivos = 0;
  let clientesEmRisco = 0;
  let clientesInativos = 0;
  let clientesNovos = 0;
  
  let somaFrequenciaGlobal = 0;
  let totalClientesComFrequencia = 0;

  const enrichedClientes = clientes.map(cliente => {
    const clientAppts = apptsPorCliente[cliente.id] || [];
    const concluidos = clientAppts.filter(a => a.status === "completed" || a.status === "finished");
    
    let crmStatus: "ATIVO" | "EM_RISCO" | "INATIVO" | "NOVO" = "NOVO";
    let ultimaVisita: string | null = null;

    if (concluidos.length === 0) {
      clientesNovos++;
    } else {
      ultimaVisita = concluidos[concluidos.length - 1].scheduled_at;
      const dataUltima = new Date(ultimaVisita);
      const diasDesdeUltima = Math.floor((hoje.getTime() - dataUltima.getTime()) / (1000 * 60 * 60 * 24));

      let frequenciaDias = 30; 
      if (concluidos.length >= 2) {
        let totalDias = 0;
        for (let i = 1; i < concluidos.length; i++) {
          const d1 = new Date(concluidos[i - 1].scheduled_at);
          const d2 = new Date(concluidos[i].scheduled_at);
          totalDias += Math.ceil(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
        }
        frequenciaDias = Math.round(totalDias / (concluidos.length - 1));
        
        somaFrequenciaGlobal += frequenciaDias;
        totalClientesComFrequencia++;
      }

      const diasAtraso = diasDesdeUltima - frequenciaDias;
      
      if (diasDesdeUltima > 90) {
        crmStatus = "INATIVO";
        clientesInativos++;
      } else if (diasAtraso > 7) { 
        crmStatus = "EM_RISCO";
        clientesEmRisco++;
      } else {
        crmStatus = "ATIVO";
        clientesAtivos++;
      }
    }

    return { ...cliente, crmStatus, ultimaVisita };
  });

  // Métricas de Operação
  const totalAgendamentos = agendamentos.length;
  const concluidosTotal = agendamentos.filter(a => a.status === "completed" || a.status === "finished").length;
  const noShowsTotal = agendamentos.filter(a => a.status === "no_show").length;
  const canceladosTotal = agendamentos.filter(a => a.status === "canceled" || a.status === "cancelled").length;

  const conversao = totalAgendamentos > 0 ? Math.round((concluidosTotal / totalAgendamentos) * 100) : 0;
  
  // Financeiro
  const receitaTotal = vendas.reduce((acc, v) => acc + Number(v.total_amount || 0), 0);
  const ticketMedio = concluidosTotal > 0 ? (receitaTotal / concluidosTotal) : 0;

  // Retenção e Frequência
  const clientesQueJaVieram = clientesAtivos + clientesEmRisco + clientesInativos;
  const taxaRetencao = clientesQueJaVieram > 0 ? Math.round(((clientesAtivos + clientesEmRisco) / clientesQueJaVieram) * 100) : 0;
  const frequenciaGlobal = totalClientesComFrequencia > 0 ? Math.round(somaFrequenciaGlobal / totalClientesComFrequencia) : 0;

  // Serviço mais consumido
  const servicosCount: Record<string, number> = {};
  agendamentos.filter(a => a.status === "completed" || a.status === "finished").forEach(a => {
    if (a.appointment_services) {
      a.appointment_services.forEach(s => {
        const name = s.services?.name;
        if (name) servicosCount[name] = (servicosCount[name] || 0) + 1;
      });
    }
  });
  let servicoTop = "Nenhum";
  let maxServ = 0;
  Object.entries(servicosCount).forEach(([n, c]) => { if (c > maxServ) { maxServ = c; servicoTop = n; } });

  const dashboardKpis = {
    ativos: clientesAtivos,
    emRisco: clientesEmRisco,
    inativos: clientesInativos,
    novos: clientesNovos,
    ticketMedio,
    conversao,
    noShows: noShowsTotal,
    cancelamentos: canceladosTotal,
    servicoTop,
    taxaRetencao,
    frequenciaGlobal
  };

  return (
    <div className="w-full max-w-[1400px] mx-auto p-4 md:p-8 animate-in fade-in duration-500 pb-24">
      <ClientManager initialClientes={enrichedClientes} globalKpis={dashboardKpis} />
    </div>
  );
}