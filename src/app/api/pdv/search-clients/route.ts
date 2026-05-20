import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");
  if (!query) return NextResponse.json({ results: [] });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: member } = await supabase.from("barbershop_members").select("barbershop_id").eq("profile_id", user.id).single();
  const cleanQuery = `%${query.trim()}%`;

  const { data: clients } = await supabase.from("clientes").select("id, name, document, phone").eq("barbershop_id", member?.barbershop_id).or(`name.ilike.${cleanQuery},document.ilike.${cleanQuery},phone.ilike.${cleanQuery}`).limit(5);

  return NextResponse.json({ results: clients || [] });
}