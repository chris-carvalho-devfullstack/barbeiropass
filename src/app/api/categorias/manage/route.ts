export const runtime = "edge";

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { categorySchema } from "@/lib/validations/category";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const payload = await req.json();
    const validated = categorySchema.safeParse(payload);
    
    if (!validated.success) return NextResponse.json({ error: validated.error }, { status: 400 });

    const { data: member } = await supabase
      .from("barbershop_members")
      .select("barbershop_id")
      .eq("profile_id", user.id)
      .in("role", ["owner", "manager"])
      .single();

    if (!member) return NextResponse.json({ error: "Permissão negada" }, { status: 403 });

    const slug = validated.data.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ /g, "-");

    const { data, error } = await supabase
      .from("product_categories")
      .insert({
        name: validated.data.name,
        slug,
        barbershop_id: member.barbershop_id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error("🚨 [API CATEGORIAS] Erro ao criar:", error);
    
    if (typeof error === "object" && error !== null && "code" in error) {
      if ((error as Record<string, unknown>).code === "23505") {
        return NextResponse.json({ error: "Já existe uma categoria com este nome." }, { status: 409 });
      }
    }

    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}