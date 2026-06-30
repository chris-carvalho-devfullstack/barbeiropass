export const runtime = "edge";

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { productSchema } from "@/lib/validations/product";

// ==========================================
// ROTA POST: CRIAÇÃO DE UM NOVO PRODUTO
// ==========================================
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

    const { stock_quantity, ...productData } = validated.data;

    // 1. Insere o Produto
    const { data: newProduct, error: productError } = await supabase
      .from("products")
      .insert({
        ...productData,
        stock_quantity: 0, // O estoque entra zerado, a trigger ou o client soma
        barbershop_id: member.barbershop_id,
        slug: productData.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ /g, "-") 
      })
      .select()
      .single();

    if (productError) throw productError;

    // 2. Event Sourcing: Registra a entrada do estoque inicial
    if (stock_quantity > 0) {
      const { error: stockError } = await supabase
        .from("stock_movements")
        .insert({
          product_id: newProduct.id,
          barbershop_id: member.barbershop_id,
          type: "IN", // Tipo de entrada
          quantity: stock_quantity
          // Removido 'reference' e 'created_by' para alinhar com seu banco de dados
        });

      if (stockError) {
        console.error("🚨 Erro ao gerar movimento de estoque inicial:", stockError);
      }
    }

    return NextResponse.json({ success: true, data: newProduct });
  } catch (error: unknown) {
    console.error("🚨 [API PRODUTOS] Erro ao criar:", error);
    
    if (typeof error === "object" && error !== null && "code" in error) {
      if ((error as Record<string, unknown>).code === "23505") {
        return NextResponse.json({ error: "SKU ou Código de Barras já cadastrado." }, { status: 409 });
      }
    }

    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}

// ==========================================
// ROTA PUT: EDIÇÃO DE UM PRODUTO EXISTENTE
// ==========================================
export async function PUT(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const payload = await req.json();
    
    const { id, stock_quantity, ...updateData } = payload;
    if (!id) return NextResponse.json({ error: "ID do produto ausente" }, { status: 400 });

    const validated = productSchema.safeParse(payload);
    if (!validated.success) return NextResponse.json({ error: validated.error }, { status: 400 });

    const { data: member } = await supabase
      .from("barbershop_members")
      .select("barbershop_id")
      .eq("profile_id", user.id)
      .in("role", ["owner", "manager"])
      .single();

    if (!member) return NextResponse.json({ error: "Permissão negada" }, { status: 403 });

    const slug = validated.data.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ /g, "-");

    // Prepara os dados ignorando o stock_quantity (O estoque não é alterado no update direto)
    const { stock_quantity: _, ...safeData } = validated.data;

    const { data, error } = await supabase
      .from("products")
      .update({
        ...safeData,
        slug,
      })
      .eq("id", id) 
      .eq("barbershop_id", member.barbershop_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error("🚨 [API PRODUTOS] Erro ao atualizar:", error);
    
    if (typeof error === "object" && error !== null && "code" in error) {
      if ((error as Record<string, unknown>).code === "23505") {
        return NextResponse.json({ error: "SKU ou Código de Barras já cadastrado em outro produto." }, { status: 409 });
      }
    }

    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}