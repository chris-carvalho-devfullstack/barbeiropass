export const runtime = "edge";

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId");

    if (!orderId) return NextResponse.json({ error: "orderId ausente" }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { data: member } = await supabase.from("barbershop_members").select("barbershop_id").eq("profile_id", user.id).single();
    if (!member) return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 403 });

    const { data, error } = await supabase
      .from("pos_orders")
      .select(`
        id, created_at, customer_name, payment_method,
        pos_order_items (
          id, quantity, unit_price, commission_amount, item_type,
          services (name),
          products (name),
          staff (full_name)
        )
      `)
      .eq("id", orderId)
      .eq("barbershop_id", member.barbershop_id)
      .single();

    if (error || !data) return NextResponse.json({ error: "Recibo não encontrado" }, { status: 404 });
    
    return NextResponse.json(data);
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Erro interno no servidor";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}