export const runtime = "edge";

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");
  const code = searchParams.get("code");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: member } = await supabase.from("barbershop_members").select("barbershop_id").eq("profile_id", user.id).single();
  if (!member) return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 403 });

  // Busca por código exato (Leitor de barras)
  if (code) {
    const { data: product } = await supabase.from("products").select("id, name, price, code").eq("code", code).eq("barbershop_id", member.barbershop_id).single();
    if (product) return NextResponse.json({ item: { ...product, type: "product" } });
    
    const { data: service } = await supabase.from("services").select("id, name, price, code").eq("code", code).eq("barbershop_id", member.barbershop_id).single();
    if (service) return NextResponse.json({ item: { ...service, type: "service" } });
    
    return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
  }

  // Busca preditiva (por digitação)
  if (!query) return NextResponse.json({ results: [] });
  const cleanQuery = `%${query.trim()}%`;

  const { data: products } = await supabase.from("products").select("id, name, price, code").eq("barbershop_id", member.barbershop_id).eq("is_active", true).or(`name.ilike.${cleanQuery},code.ilike.${cleanQuery}`).limit(5);
  const { data: services } = await supabase.from("services").select("id, name, price, code").eq("barbershop_id", member.barbershop_id).eq("is_active", true).or(`name.ilike.${cleanQuery},code.ilike.${cleanQuery}`).limit(5);

  const formattedResults = [
    ...(products || []).map(p => ({ ...p, code: p.code || '', type: 'product' })),
    ...(services || []).map(s => ({ ...s, code: s.code || '', type: 'service' }))
  ];

  return NextResponse.json({ results: formattedResults });
}