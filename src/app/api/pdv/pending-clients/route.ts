export const runtime = "edge";

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: member } = await supabase.from("barbershop_members").select("barbershop_id").eq("profile_id", user.id).single();
  if (!member) return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 403 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data: appointments } = await supabase.from("appointments").select("id, client_name, client_phone, client_id, scheduled_at").eq("barbershop_id", member.barbershop_id).gte("scheduled_at", today.toISOString()).lt("scheduled_at", tomorrow.toISOString()).in("status", ["scheduled", "confirmed"]);
  
  const { data: queue } = await supabase.from("virtual_queue").select("id, client_name, joined_at, status").eq("barbershop_id", member.barbershop_id).in("status", ["waiting", "in_progress"]);

  return NextResponse.json({ appointments: appointments || [], queue: queue || [] });
}