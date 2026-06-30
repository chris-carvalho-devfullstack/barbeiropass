export const runtime = "edge";

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("id");

    if (!categoryId) return NextResponse.json({ error: "ID não fornecido" }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { data: member } = await supabase
      .from("barbershop_members")
      .select("barbershop_id")
      .eq("profile_id", user.id)
      .in("role", ["owner", "manager"])
      .single();

    if (!member) return NextResponse.json({ error: "Permissão negada" }, { status: 403 });

    // 1. Verificação de Vínculo: Checar se existem produtos usando esta categoria
    const { count } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("category_id", categoryId)
      .eq("barbershop_id", member.barbershop_id)
      .is("deleted_at", null); // Ignora produtos que já sofreram soft delete

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Não é possível apagar. Existem ${count} produto(s) vinculado(s) a esta categoria. Mude a categoria deles primeiro.` }, 
        { status: 409 }
      );
    }

    // 2. Tenta apagar a categoria. 
    // NOTA DE SEGURANÇA: O RLS do Supabase já bloqueia a exclusão se barbershop_id for NULL (Categoria Padrão)
    const { error } = await supabase
      .from("product_categories")
      .delete()
      .eq("id", categoryId)
      .eq("barbershop_id", member.barbershop_id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("🚨 [API CATEGORIAS] Erro no DELETE:", errorMessage);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}