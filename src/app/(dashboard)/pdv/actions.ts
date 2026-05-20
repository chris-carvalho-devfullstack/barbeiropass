// src/app/(dashboard)/pdv/actions.ts
"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export const runtime = "edge";

// ============================================================================
// SCHEMAS DE VALIDAÇÃO
// ============================================================================

const checkoutSchema = z.object({
  cashRegisterId: z.string().uuid("Caixa inválido"),
  paymentMethod: z.enum(["pix", "credit_card", "debit_card", "cash"]),
  clientId: z.string().uuid().optional().nullable(), // <-- ADICIONADO AQUI
  items: z.array(z.object({
    id: z.string().uuid(),
    type: z.enum(["product", "service"]),
    quantity: z.number().min(1)
  })).min(1, "O carrinho está vazio")
});

// ============================================================================
// 1. PROCESSAMENTO DE CHECKOUT (ZERO TRUST)
// ============================================================================

export async function processCheckout(payload: z.infer<typeof checkoutSchema>) {
  const parsed = checkoutSchema.safeParse(payload);
  if (!parsed.success) return { error: "Payload inválido detectado." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  // Descobre a barbearia do usuário autenticado
  const { data: member } = await supabase
    .from("barbershop_members")
    .select("barbershop_id")
    .eq("profile_id", user.id)
    .single();

  if (!member) return { error: "Vínculo com barbearia não encontrado." };

  let realTotalAmount = 0;
  const orderItemsToInsert = [];

  // Recálculo absoluto no servidor para cada item
  for (const item of parsed.data.items) {
    let unitPrice = 0;

    if (item.type === "product") {
      const { data: product } = await supabase
        .from("products")
        .select("price, stock_quantity")
        .eq("id", item.id)
        .eq("barbershop_id", member.barbershop_id)
        .single();
      
      if (!product) return { error: `Produto inválido: ${item.id}` };
      if (product.stock_quantity < item.quantity) return { error: "Estoque insuficiente." };
      
      unitPrice = product.price;

      // Desconta do estoque
      await supabase.from("products").update({ stock_quantity: product.stock_quantity - item.quantity }).eq("id", item.id);

    } else if (item.type === "service") {
      const { data: service } = await supabase
        .from("services")
        .select("price")
        .eq("id", item.id)
        .eq("barbershop_id", member.barbershop_id)
        .single();
      
      if (!service) return { error: `Serviço inválido: ${item.id}` };
      unitPrice = service.price;
    }

    realTotalAmount += (unitPrice * item.quantity);
    
    orderItemsToInsert.push({
      item_type: item.type,
      product_id: item.type === "product" ? item.id : null,
      service_id: item.type === "service" ? item.id : null,
      quantity: item.quantity,
      unit_price: unitPrice,
      commission_amount: 0 // Lógica de comissão pode ser injetada aqui depois
    });
  }

 // Cria o Pedido (pos_orders) com o valor recalculado
  const { data: order, error: orderError } = await supabase
    .from("pos_orders")
    .insert({
      barbershop_id: member.barbershop_id,
      cash_register_id: parsed.data.cashRegisterId,
      customer_id: parsed.data.clientId || null, // <-- ADICIONADO AQUI
      total_amount: realTotalAmount,
      payment_method: parsed.data.paymentMethod
    })
    .select("id")
    .single();

  if (orderError) return { error: "Erro ao registrar a venda." };

  // Associa os itens ao pedido
  const itemsComOrderId = orderItemsToInsert.map(i => ({ ...i, order_id: order.id }));
  
  const { error: itemsError } = await supabase
    .from("pos_order_items")
    .insert(itemsComOrderId);

  if (itemsError) return { error: "Erro ao salvar os itens da venda." };

  revalidatePath("/dashboard/pdv");
  return { success: true, orderId: order.id };
}

// ============================================================================
// 2. BUSCA POR CÓDIGO EXATO (PARA LEITOR DE CÓDIGO DE BARRAS)
// ============================================================================

export async function fetchItemByCode(code: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado" };

  const { data: member } = await supabase
    .from("barbershop_members")
    .select("barbershop_id")
    .eq("profile_id", user.id)
    .single();

  if (!member) return { error: "Barbearia não encontrada" };

  // Tenta achar em Produtos primeiro
  const { data: product } = await supabase
    .from("products")
    .select("id, name, price, code")
    .eq("code", code)
    .eq("barbershop_id", member.barbershop_id)
    .single();

  if (product) {
    return { item: { id: product.id, name: product.name, price: product.price, type: "product", code: product.code } };
  }

  // Se não achou em Produtos, tenta em Serviços
  const { data: service } = await supabase
    .from("services")
    .select("id, name, price, code")
    .eq("code", code)
    .eq("barbershop_id", member.barbershop_id)
    .single();

  if (service) {
    return { item: { id: service.id, name: service.name, price: service.price, type: "service", code: service.code } };
  }

  return { error: "Item não encontrado" };
}

// ============================================================================
// 3. BUSCA PREDITIVA (AUTOCOMPLETAR AO DIGITAR NOME OU SKU)
// ============================================================================

export async function searchItemsAction(query: string) {
  if (!query || query.trim().length < 2) return { results: [] };
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado" };

  const { data: member } = await supabase
    .from("barbershop_members")
    .select("barbershop_id")
    .eq("profile_id", user.id)
    .single();

  if (!member) return { error: "Barbearia não encontrada" };

  const cleanQuery = `%${query.trim()}%`;

  // Busca produtos correspondentes por nome ou código
  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, code")
    .eq("barbershop_id", member.barbershop_id)
    .eq("is_active", true)
    .or(`name.ilike.${cleanQuery},code.ilike.${cleanQuery}`)
    .limit(5);

  // Busca serviços correspondentes por nome ou código
  const { data: services } = await supabase
    .from("services")
    .select("id, name, price, code")
    .eq("barbershop_id", member.barbershop_id)
    .eq("is_active", true)
    .or(`name.ilike.${cleanQuery},code.ilike.${cleanQuery}`)
    .limit(5);

  const formattedResults = [
    ...(products || []).map(p => ({ id: p.id, name: p.name, price: p.price, code: p.code || '', type: 'product' as const })),
    ...(services || []).map(s => ({ id: s.id, name: s.name, price: s.price, code: s.code || '', type: 'service' as const }))
  ];

  return { results: formattedResults };
}

export async function searchClientForPDV(query: string) {
  if (!query || query.length < 3) return { results: [] };
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado" };

  const { data: member } = await supabase.from("barbershop_members").select("barbershop_id").eq("profile_id", user.id).single();
  if (!member) return { error: "Barbearia não encontrada" };

  const cleanQuery = `%${query.trim()}%`;

  const { data: clients } = await supabase
    .from("clientes")
    .select("id, name, document, phone")
    .eq("barbershop_id", member.barbershop_id)
    .or(`name.ilike.${cleanQuery},document.ilike.${cleanQuery},phone.ilike.${cleanQuery}`)
    .limit(5);

  return { results: clients || [] };
}

export async function quickCreateClient(name: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado" };

  const { data: member } = await supabase.from("barbershop_members").select("barbershop_id").eq("profile_id", user.id).single();

  const { data: newClient, error } = await supabase
    .from("clientes")
    .insert({
      barbershop_id: member?.barbershop_id,
      name,
    })
    .select("id, name, document")
    .single();

  if (error) return { error: "Erro ao cadastrar cliente." };
  return { client: newClient };
}

// Adicione no final do seu src/app/(dashboard)/pdv/actions.ts

// Substitua esta função no final do arquivo src/app/(dashboard)/pdv/actions.ts

export async function getPendingClientsForPDV() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado" };

  const { data: member } = await supabase.from("barbershop_members").select("barbershop_id").eq("profile_id", user.id).single();
  if (!member) return { error: "Barbearia não encontrada" };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Busca Agendamentos de Hoje
  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, client_name, client_phone, client_id, scheduled_at")
    .eq("barbershop_id", member.barbershop_id)
    .gte("scheduled_at", today.toISOString())
    .lt("scheduled_at", tomorrow.toISOString())
    .in("status", ["scheduled", "confirmed"]);

  // Busca Fila Virtual Ativa COM O STATUS
  const { data: queue } = await supabase
    .from("virtual_queue")
    .select("id, client_name, joined_at, status") // <-- Adicionamos o status aqui
    .eq("barbershop_id", member.barbershop_id)
    .in("status", ["waiting", "in_progress"]);

  return {
    appointments: appointments || [],
    queue: queue || []
  };
}