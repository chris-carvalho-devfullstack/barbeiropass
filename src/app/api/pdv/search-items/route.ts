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

  // Busca por código exato (Leitor de barras bipando SKU ou EAN)
  if (code) {
    // 1. Tenta encontrar em produtos usando sku ou barcode
    const { data: product } = await supabase
      .from("products")
      .select("id, name, price, sku, barcode")
      .eq("barbershop_id", member.barbershop_id)
      .or(`sku.eq.${code},barcode.eq.${code}`)
      .maybeSingle(); // Usa maybeSingle para não lançar erro se não achar
      
    if (product) return NextResponse.json({ item: { ...product, type: "product" } });
    
    // 2. Se não for produto, tenta achar em serviços (que usam a coluna code)
    const { data: service } = await supabase
      .from("services")
      .select("id, name, price, code")
      .eq("code", code)
      .eq("barbershop_id", member.barbershop_id)
      .maybeSingle();
      
    if (service) return NextResponse.json({ item: { ...service, type: "service" } });
    
    return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
  }

  // Busca preditiva (por digitação no frontend)
  if (!query) return NextResponse.json({ results: [] });
  const cleanQuery = `%${query.trim()}%`;

  // Busca de produtos pela nova arquitetura (Name, SKU ou Barcode)
  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, sku, barcode")
    .eq("barbershop_id", member.barbershop_id)
    .eq("is_active", true)
    .or(`name.ilike.${cleanQuery},sku.ilike.${cleanQuery},barcode.ilike.${cleanQuery}`)
    .limit(5);

  // Busca de serviços (Name ou Code)
  const { data: services } = await supabase
    .from("services")
    .select("id, name, price, code")
    .eq("barbershop_id", member.barbershop_id)
    .eq("is_active", true)
    .or(`name.ilike.${cleanQuery},code.ilike.${cleanQuery}`)
    .limit(5);

  // Formata a resposta para mapear com o store do frontend
  const formattedResults = [
    ...(products || []).map(p => ({ ...p, sku: p.sku || '', barcode: p.barcode || null, type: 'product' })),
    // Para serviços, mapeamos o 'code' para 'sku' no frontend para reaproveitar a tipagem do PDVItem
    ...(services || []).map(s => ({ ...s, sku: s.code || '', type: 'service' })) 
  ];

  return NextResponse.json({ results: formattedResults });
}