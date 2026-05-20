// src/app/api/verify-pin/route.ts
export const runtime = 'edge'; // OBRIGATÓRIO PARA A CLOUDFLARE

import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { barbershopId, providedPin } = await req.json();
    const supabase = await createClient();
    
    const { data: barbershop } = await supabase
      .from("barbershops")
      .select("checkin_pin")
      .eq("id", barbershopId)
      .single();

    if (!barbershop || !barbershop.checkin_pin) {
      return NextResponse.json({ success: false, error: "Barbearia não configurou o PIN." });
    }

    if (barbershop.checkin_pin === providedPin.trim()) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Código incorreto. Verifique no balcão." });
  } catch (err) {
    console.error("[API PIN ERROR]", err);
    return NextResponse.json({ success: false, error: "Erro ao validar o código." }, { status: 500 });
  }
}