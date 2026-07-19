// src/app/api/leave-queue/route.ts
export const runtime = 'edge';
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { queueId, barbershopId } = await req.json();
    if (!queueId || !barbershopId) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

    const supabaseAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // Muda o status para 'canceled' em vez de deletar fisicamente, garantindo auditoria e métricas.
    const { error } = await supabaseAdmin
      .from("virtual_queue")
      .update({ status: 'canceled' })
      .eq('id', queueId)
      .eq('barbershop_id', barbershopId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Erro ao sair da fila." }, { status: 500 });
  }
}