// src/app/(dashboard)/clientes/[id]/page.tsx
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import ClientProfile from "./client-profile";

export const runtime = "edge";

interface AppointmentRaw {
  id: string;
  scheduled_at: string;
  status: string;
  barber_id: string | null;
  client_name: string;
  client_phone: string | null;
  staff: { full_name: string | null } | { full_name: string | null }[] | null;
  appointment_services: { services: { name: string; price: number; duration_minutes: number } | null }[] | null;
}

interface PosOrderRaw {
  id: string;
  total_amount: number;
  created_at: string;
  payment_method: string | null;
  pos_order_items?: {
    quantity: number;
    unit_price: number;
    item_type: string;
    products?: { name: string } | null;
    services?: { name: string } | null;
  }[] | null;
}

// -----------------------------------------------------------------------
// Função Utilitária: Tradutor de Métodos de Pagamento
// -----------------------------------------------------------------------
function formatPaymentMethod(method: string | null): string {
  if (!method) return "Não informado";
  
  switch (method.toLowerCase()) {
    case 'credit_card':
    case 'credit':
      return "Cartão de Crédito";
    case 'debit_card':
    case 'debit':
      return "Cartão de Débito";
    case 'pix':
      return "PIX";
    case 'cash':
      return "Dinheiro";
    default:
      return method.charAt(0).toUpperCase() + method.slice(1);
  }
}

export default async function ClienteProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const clientId = params.id;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("barbershop_members")
    .select("barbershop_id")
    .eq("profile_id", user.id)
    .single();

  if (!member) redirect("/dashboard");

  // 1. Dados cadastrais
  const { data: cliente, error: clienteError } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", clientId)
    .eq("barbershop_id", member.barbershop_id)
    .single();

  if (clienteError || !cliente) {
    redirect("/clientes"); 
  }

  // 2. Histórico completo de Agendamentos + Serviços da Pivot
  const { data: agendamentos } = await supabase
    .from("appointments")
    .select(`
      id, scheduled_at, status, barber_id, client_name, client_phone,
      staff:barber_id ( full_name ),
      appointment_services (
        services ( name, price, duration_minutes )
      )
    `)
    .eq("client_id", clientId)
    .order("scheduled_at", { ascending: false });

  // 3. Vendas do PDV
  const { data: posOrders } = await supabase
    .from("pos_orders")
    .select(`
      id, total_amount, created_at, payment_method,
      pos_order_items (
        quantity,
        unit_price,
        item_type,
        products ( name ),
        services ( name )
      )
    `)
    .eq("customer_id", clientId)
    .order("created_at", { ascending: false });

  // 4. Event Log (Linha do Tempo)
  const { data: eventLog } = await supabase
    .from("event_log")
    .select("*")
    .eq("entity_id", clientId)
    .order("created_at", { ascending: false })
    .limit(30);

  // =======================================================================
  // 🧠 CÁLCULOS DE INTELIGÊNCIA (KPIs)
  // =======================================================================
  const agendamentosValidos = (agendamentos as unknown as AppointmentRaw[]) || [];
  const vendasValidas = (posOrders as unknown as PosOrderRaw[]) || [];

  const concluidos = agendamentosValidos.filter(a => a.status === "completed" || a.status === "finished");
  const noShows = agendamentosValidos.filter(a => a.status === "no_show");
  const cancelados = agendamentosValidos.filter(a => a.status === "canceled" || a.status === "cancelled");

  const ltv = vendasValidas.reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0);
  const ticketMedio = concluidos.length > 0 ? (ltv / concluidos.length) : 0;

  let ultimaVisita: string | null = null;
  let proximaVisita: string | null = null;
  let frequenciaMediaDias = 0;

  if (concluidos.length > 0) {
    const concluidosCronologico = [...concluidos].reverse();
    ultimaVisita = concluidosCronologico[concluidosCronologico.length - 1].scheduled_at;

    if (concluidosCronologico.length >= 2 && ultimaVisita) {
      let totalDias = 0;
      for (let i = 1; i < concluidosCronologico.length; i++) {
        const d1 = new Date(concluidosCronologico[i - 1].scheduled_at);
        const d2 = new Date(concluidosCronologico[i].scheduled_at);
        const diffTempo = Math.abs(d2.getTime() - d1.getTime());
        totalDias += Math.ceil(diffTempo / (1000 * 60 * 60 * 24));
      }
      frequenciaMediaDias = Math.round(totalDias / (concluidosCronologico.length - 1));

      const dataUltima = new Date(ultimaVisita);
      const dataProxima = new Date(dataUltima.getTime() + (frequenciaMediaDias * 24 * 60 * 60 * 1000));
      proximaVisita = dataProxima.toISOString();
    }
  }

  // 🏆 Lógica Nova: Profissional e Serviço Favorito
  const barbeirosCount: Record<string, { nome: string, count: number }> = {};
  const servicosCount: Record<string, number> = {};

  concluidos.forEach(a => {
    // Conta Barbeiros
    if (a.barber_id && a.staff && !Array.isArray(a.staff)) {
      const nome = a.staff.full_name || "Barbeiro";
      if (!barbeirosCount[a.barber_id]) barbeirosCount[a.barber_id] = { nome, count: 0 };
      barbeirosCount[a.barber_id].count += 1;
    }
    
    // Conta Serviços
    if (a.appointment_services) {
      a.appointment_services.forEach(as => {
        const srvName = as.services?.name;
        if (srvName) {
          servicosCount[srvName] = (servicosCount[srvName] || 0) + 1;
        }
      });
    }
  });

  let profissionalFavorito = "Não definido";
  let maxCortes = 0;
  Object.values(barbeirosCount).forEach(b => {
    if (b.count > maxCortes) { maxCortes = b.count; profissionalFavorito = b.nome; }
  });

  let servicoFavorito = "Não definido";
  let maxServicos = 0;
  Object.entries(servicosCount).forEach(([nome, count]) => {
    if (count > maxServicos) { maxServicos = count; servicoFavorito = nome; }
  });

  // Health Score
  let healthScore = 100;
  const totalAgendamentos = agendamentosValidos.length;
  if (totalAgendamentos > 0) {
    const taxaFaltas = noShows.length / totalAgendamentos;
    healthScore -= (taxaFaltas * 50);
  }

  if (proximaVisita) {
    const hoje = new Date();
    const dataPrevista = new Date(proximaVisita);
    const diasAtraso = Math.floor((hoje.getTime() - dataPrevista.getTime()) / (1000 * 60 * 60 * 24));
    if (diasAtraso > 0) {
      healthScore -= Math.min(diasAtraso * 2, 40);
    } else {
      healthScore += 5;
    }
  }

  healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));
  if (ltv > 500 && healthScore < 100) healthScore = Math.min(100, healthScore + 5);

  let crmStatus = "VIP";
  if (healthScore >= 80) crmStatus = "FIEL";
  else if (healthScore >= 50) crmStatus = "REGULAR";
  else if (healthScore >= 30) crmStatus = "EM_RISCO";
  else crmStatus = "PERDIDO";

  if (concluidos.length === 0) crmStatus = "NOVO";

  // Montagem do payload
  const customerProfileData = {
    dadosPessoais: {
      id: cliente.id,
      nome: cliente.name,
      telefone: cliente.phone,
      email: cliente.email,
      membroDesde: cliente.created_at,
      statusConta: cliente.status
    },
    kpis: {
      ltv,
      ticketMedio,
      totalVisitas: concluidos.length,
      frequenciaDias: frequenciaMediaDias,
      ultimaVisita,
      proximaVisita,
      healthScore,
      crmStatus,
      noShows: noShows.length,
      cancelamentos: cancelados.length,
      profissionalFavorito,
      servicoFavorito // <- Enviando o Serviço Favorito
    },
    agendamentos: agendamentosValidos.map(a => ({
      id: a.id,
      scheduled_at: a.scheduled_at,
      status: a.status,
      barberName: (!Array.isArray(a.staff) && a.staff?.full_name) || "Profissional",
      services: (a.appointment_services || [])
        .map(s => s.services?.name)
        .filter((name): name is string => typeof name === "string") 
    })),
    comprasPDV: vendasValidas.map(v => ({
      id: v.id,
      total: v.total_amount,
      date: v.created_at,
      method: formatPaymentMethod(v.payment_method),
      items: (v.pos_order_items || []).map(item => ({
        name: item.products?.name || item.services?.name || `Item (${item.item_type})`,
        quantity: item.quantity || 1
      }))
    })),
    timeline: eventLog || []
  };

  return (
    <div className="w-full">
      <ClientProfile initialData={customerProfileData} />
    </div>
  );
}