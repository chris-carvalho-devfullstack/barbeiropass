// src/app/api/pdv/pending-clients/route.ts
export const runtime = "edge";

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export interface PendingService {
  id: string;
  name: string;
  price: number;
  code?: string | null;
}

// Tipagem segura para a resposta unificada da API
export interface PendingClientResponse {
  id: string;
  clientName: string;
  clientId: string | null;
  barberId: string | null;
  barberName: string | null;
  origin: "queue" | "appointment";
  time: string;
  services: PendingService[]; // Suporta múltiplos serviços
}

export async function GET() {
  try {
    const supabase = await createClient();

    // 1. Autenticação e Validação de Vínculo com a Barbearia
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { data: member } = await supabase
      .from("barbershop_members")
      .select("barbershop_id")
      .eq("profile_id", user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: "Vínculo com barbearia não encontrado." }, { status: 403 });
    }

    const barbershopId = member.barbershop_id;

    // 2. BUSCA NA FILA VIRTUAL (Clientes com corte finalizado na cadeira, aguardando pagamento)
    const { data: queueData, error: queueError } = await supabase
      .from("virtual_queue")
      .select(`
        id,
        client_name,
        client_id,
        barber_id,
        barber_name,
        joined_at,
        service_ids
      `)
      .eq("barbershop_id", barbershopId)
      .eq("status", "awaiting_payment");

    if (queueError) {
      console.error("[PDV API ERROR] Falha ao buscar fila pendente:", queueError);
      return NextResponse.json({ error: "Erro ao buscar clientes da fila." }, { status: 500 });
    }

    // 2.1 Extrai e busca os detalhes de todos os serviços únicos da Fila
    const allServiceIds = [...new Set((queueData || []).flatMap(q => q.service_ids || []))];
    
    // Tipagem explícita com a interface PendingService
    let servicesData: PendingService[] = [];

    if (allServiceIds.length > 0) {
      const { data: sData, error: sError } = await supabase
        .from("services")
        .select("id, name, price, code")
        .in("id", allServiceIds);
        
      if (!sError && sData) {
        servicesData = sData as PendingService[];
      }
    }

    // 3. BUSCA NOS AGENDAMENTOS
    const { data: appointmentsData, error: appointmentsError } = await supabase
      .from("appointments")
      .select(`
        id,
        client_name,
        client_id,
        barber_id,
        scheduled_at,
        appointment_services (
          services ( id, name, price, code )
        ),
        staff ( full_name )
      `)
      .eq("barbershop_id", barbershopId)
      .eq("status", "awaiting_payment");

    if (appointmentsError) {
      console.error("[PDV API ERROR] Falha ao buscar agendamentos pendentes:", appointmentsError);
      return NextResponse.json({ error: "Erro ao buscar agendamentos." }, { status: 500 });
    }

    // 4. PADRONIZAÇÃO E UNIÃO DOS DADOS (Data Mapping)
    const pendingQueue: PendingClientResponse[] = (queueData || []).map((q) => {
      
      const clientServices = (q.service_ids || [])
        .map((id: string) => servicesData.find((s: PendingService) => s.id === id))
        .filter((s: PendingService | undefined): s is PendingService => s !== undefined)
        .map((s: PendingService) => ({
          id: s.id,
          name: s.name,
          price: Number(s.price),
          code: s.code
        }));

      return {
        id: q.id,
        clientName: q.client_name,
        clientId: q.client_id,
        barberId: q.barber_id,
        barberName: q.barber_name,
        origin: "queue",
        time: q.joined_at,
        services: clientServices
      };
    });

    const pendingAppointments: PendingClientResponse[] = (appointmentsData || []).map((a) => {
      const staffInfo = a.staff as unknown as { full_name: string } | null;
      
      const pivotData = a.appointment_services as unknown as Array<{ services: { id: string; name: string; price: number; code?: string | null } | null }> | null;

      const clientServices = (pivotData || [])
        .map(as => as.services)
        .filter((s): s is { id: string; name: string; price: number; code?: string | null } => s !== null)
        .map(s => ({
          id: s.id,
          name: s.name,
          price: Number(s.price),
          code: s.code
        }));

      return {
        id: a.id,
        clientName: a.client_name,
        clientId: a.client_id,
        barberId: a.barber_id,
        barberName: staffInfo ? staffInfo.full_name : null,
        origin: "appointment",
        time: a.scheduled_at,
        services: clientServices
      };
    });

    // 5. UNIFICAR E ORDENAR (Os mais antigos/primeiros que terminaram aparecem no topo)
    const unifiedList = [...pendingQueue, ...pendingAppointments].sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
    );

    return NextResponse.json(unifiedList);

  } catch (e) {
    console.error("[PDV API CRITICAL ERROR]", e);
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}