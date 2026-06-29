export const runtime = "edge";

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// ALTERAR STATUS (Ativar/Desativar)
export async function PATCH(req: Request) {
  try {
    const { productId, currentStatus } = await req.json();

    if (!productId || typeof currentStatus !== "boolean") {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
    }

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

    // ZERO TRUST: Garantindo que o produto pertence ao tenant do usuário
    const { error } = await supabase
      .from("products")
      .update({ is_active: !currentStatus })
      .eq("id", productId)
      .eq("barbershop_id", member.barbershop_id);

    if (error) throw error;

    // Invalida o cache para atualizar a tela na hora
    revalidatePath("/(dashboard)/produtos", "page");
    revalidatePath("/(dashboard)/pdv", "page"); 

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    // Tratamento tipado do erro
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("🚨 [API PRODUTOS] Erro no PATCH:", errorMessage);
    
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}

// EXCLUSÃO LÓGICA (Soft Delete)
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("id");

    if (!productId) return NextResponse.json({ error: "ID não fornecido" }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { data: member } = await supabase
      .from("barbershop_members")
      .select("barbershop_id")
      .in("role", ["owner", "manager"])
      .eq("profile_id", user.id)
      .single();

    if (!member) return NextResponse.json({ error: "Permissão negada" }, { status: 403 });

    // Exclusão Lógica: Inativa o produto e "libera" o SKU/Slug
    const timestamp = Date.now();
    const { error } = await supabase
      .from("products")
      .update({ 
        is_active: false, 
        sku: `deleted-${timestamp}-${productId}`,
        slug: `deleted-${timestamp}-${productId}` 
      })
      .eq("id", productId)
      .eq("barbershop_id", member.barbershop_id);

    if (error) throw error;

    revalidatePath("/(dashboard)/produtos", "page");
    
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    // Tratamento tipado do erro
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("🚨 [API PRODUTOS] Erro no DELETE:", errorMessage);
    
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}