export const runtime = "edge";

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { productSchema } from "@/lib/validations/product";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const payload = await req.json();
    const validated = productSchema.safeParse(payload);
    
    if (!validated.success) return NextResponse.json({ error: validated.error }, { status: 400 });

    const { data: member } = await supabase
      .from("barbershop_members")
      .select("barbershop_id")
      .eq("profile_id", user.id)
      .in("role", ["owner", "manager"])
      .single();

    if (!member) return NextResponse.json({ error: "Permissão negada" }, { status: 403 });

    const { data, error } = await supabase
      .from("products")
      .insert({
        ...validated.data,
        barbershop_id: member.barbershop_id,
        slug: validated.data.name.toLowerCase().replace(/ /g, "-") // Slug simples
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error("🚨 [API PRODUTOS] Erro ao criar:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}