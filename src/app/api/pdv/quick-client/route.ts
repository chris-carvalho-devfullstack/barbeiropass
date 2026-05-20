export const runtime = "edge";

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  const { name } = await req.json();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: member } = await supabase.from("barbershop_members").select("barbershop_id").eq("profile_id", user.id).single();

  const { data: newClient, error } = await supabase.from("clientes").insert({ barbershop_id: member?.barbershop_id, name }).select("id, name, document").single();
  if (error) return NextResponse.json({ error: "Erro ao cadastrar cliente." }, { status: 500 });
  
  return NextResponse.json({ client: newClient });
}