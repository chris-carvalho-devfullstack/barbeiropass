// src/app/api/agendamentos/disponibilidade/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    // Proteção Zero-Trust: Garantir que quem está consultando está logado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    // Coleta e validação dos parâmetros enviados pelo frontend
    const { searchParams } = new URL(request.url);
    const barber_id = searchParams.get("barber_id");
    const date = searchParams.get("date"); // Formato esperado: YYYY-MM-DD
    const duration = searchParams.get("duration"); // Duração total dos serviços em minutos

    if (!barber_id || !date || !duration) {
      return NextResponse.json(
        { error: "Parâmetros 'barber_id', 'date' e 'duration' são obrigatórios." }, 
        { status: 400 }
      );
    }

    // Chamada direta para a Stored Procedure (RPC) que criamos no banco
    const { data, error } = await supabase.rpc("get_available_slots", {
      p_staff_id: barber_id,
      p_date: date,
      p_service_duration: parseInt(duration, 10),
    });

    if (error) {
      console.error("[ERRO_RPC_DISPONIBILIDADE]", error);
      throw new Error("Falha ao calcular horários disponíveis.");
    }

    // O banco retorna [{ available_slot: "09:00:00" }, ...]
    // Vamos mapear para um array limpo de strings no formato "HH:mm" para o frontend
    const formatedSlots = data?.map((item: { available_slot: string }) => 
      item.available_slot.substring(0, 5)
    ) || [];

    return NextResponse.json({ data: formatedSlots }, { status: 200 });

  } catch (error: unknown) {
    console.error("[ERRO_API_DISPONIBILIDADE]", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}