export const runtime = "edge";

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const staffId = searchParams.get("staffId");
    const period = searchParams.get("period") || "hoje";
    const limit = Number(searchParams.get("limit")) || 10;
    const page = Number(searchParams.get("page")) || 1;

    if (!staffId) return NextResponse.json({ error: "staffId ausente" }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { data: member } = await supabase.from("barbershop_members").select("barbershop_id").eq("profile_id", user.id).single();
    if (!member) return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 403 });

    const offset = (page - 1) * limit;

    let query = supabase
      .from("staff_financial_ledgers")
      .select("*", { count: 'exact' })
      .eq("staff_id", staffId)
      .eq("barbershop_id", member.barbershop_id)
      .order("created_at", { ascending: false });

    const now = new Date();
    if (period === "hoje") {
      query = query.gte("created_at", new Date(now.setHours(0, 0, 0, 0)).toISOString());
    } else if (period === "semana") {
      query = query.gte("created_at", new Date(now.setDate(now.getDate() - 7)).toISOString());
    } else if (period === "mes") {
      query = query.gte("created_at", new Date(now.getFullYear(), now.getMonth(), 1).toISOString());
    }

    const { data, count, error } = await query.range(offset, offset + limit - 1);
    if (error) throw error;
    
    return NextResponse.json({ data, count });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Erro interno no servidor";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}