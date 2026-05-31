export const runtime = "edge";

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const checkoutSchema = z.object({
  cashRegisterId: z.string().uuid("Caixa inválido"),
  paymentMethod: z.enum(["pix", "credit_card", "debit_card", "cash"]),
  clientId: z.string().uuid().optional().nullable(),
  appointmentId: z.string().uuid().optional().nullable(), // Adicionado para vinculação
  items: z.array(z.object({
    id: z.string().uuid(),
    type: z.enum(["product", "service"]),
    quantity: z.number().min(1),
    barberId: z.string().uuid().optional().nullable() // Identificador do barbeiro
  })).min(1, "O carrinho está vazio")
});

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const parsed = checkoutSchema.safeParse(payload);
    if (!parsed.success) return NextResponse.json({ error: "Payload inválido detectado." }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const { data: member } = await supabase.from("barbershop_members").select("barbershop_id").eq("profile_id", user.id).single();
    if (!member) return NextResponse.json({ error: "Vínculo com barbearia não encontrado." }, { status: 403 });

    let realTotalAmount = 0;
    const orderItemsToInsert = [];
    const ledgersToInsert = []; // Array para guardar os pagamentos aos barbeiros

    for (const item of parsed.data.items) {
      let unitPrice = 0;
      let commissionAmount = 0;

      if (item.type === "product") {
        const { data: product } = await supabase.from("products").select("price, stock_quantity").eq("id", item.id).eq("barbershop_id", member.barbershop_id).single();
        if (!product) return NextResponse.json({ error: `Produto inválido: ${item.id}` }, { status: 400 });
        if (product.stock_quantity < item.quantity) return NextResponse.json({ error: "Estoque insuficiente." }, { status: 400 });
        
        unitPrice = product.price;
        await supabase.from("products").update({ stock_quantity: product.stock_quantity - item.quantity }).eq("id", item.id);
        
        // Adiciona ao pedido sem comissão (produtos geralmente não têm, mas pode adaptar no futuro)
        orderItemsToInsert.push({
          item_type: item.type, product_id: item.id, service_id: null,
          quantity: item.quantity, unit_price: unitPrice, commission_amount: 0, barber_id: null
        });

      } else if (item.type === "service") {
        const { data: service } = await supabase.from("services").select("price, name").eq("id", item.id).eq("barbershop_id", member.barbershop_id).single();
        if (!service) return NextResponse.json({ error: `Serviço inválido: ${item.id}` }, { status: 400 });
        
        unitPrice = service.price;

        // CALCULAR COMISSÃO SE HOUVER UM BARBEIRO ATRIBUÍDO
        if (item.barberId) {
          const { data: comm } = await supabase.from("staff_service_commissions")
            .select("commission_percentage")
            .eq("staff_id", item.barberId)
            .eq("service_id", item.id)
            .single();

          if (comm && comm.commission_percentage > 0) {
            commissionAmount = (unitPrice * item.quantity) * (Number(comm.commission_percentage) / 100);
            
            // Preparar o lançamento para o Ledger Financeiro
            ledgersToInsert.push({
              barbershop_id: member.barbershop_id,
              staff_id: item.barberId,
              appointment_id: parsed.data.appointmentId || null,
              transaction_type: "commission_earned",
              amount: commissionAmount,
              description: `Comissão - ${service.name}`
            });
          }
        }

        orderItemsToInsert.push({
          item_type: item.type, product_id: null, service_id: item.id,
          quantity: item.quantity, unit_price: unitPrice, commission_amount: commissionAmount,
          barber_id: item.barberId || null
        });
      }

      realTotalAmount += (unitPrice * item.quantity);
    }

    // 1. Criar a Ordem de Venda (POS Order)
    const { data: order, error: orderError } = await supabase.from("pos_orders").insert({
      barbershop_id: member.barbershop_id, cash_register_id: parsed.data.cashRegisterId, customer_id: parsed.data.clientId || null,
      total_amount: realTotalAmount, payment_method: parsed.data.paymentMethod
    }).select("id").single();

    if (orderError) return NextResponse.json({ error: "Erro ao registar a venda." }, { status: 500 });

    // 2. Inserir os Itens da Venda
    const itemsComOrderId = orderItemsToInsert.map(i => ({ ...i, order_id: order.id }));
    const { error: itemsError } = await supabase.from("pos_order_items").insert(itemsComOrderId);
    if (itemsError) return NextResponse.json({ error: "Erro ao salvar os itens da venda." }, { status: 500 });

    // 3. DISTRIBUIR O DINHEIRO (Inserir no Ledger)
    if (ledgersToInsert.length > 0) {
      const { error: ledgerError } = await supabase.from("staff_financial_ledgers").insert(ledgersToInsert);
      if (ledgerError) console.error("Falha ao registar a comissão no livro razão:", ledgerError);
    }

    // 4. ATUALIZAR AGENDA (Se vier de um agendamento, marca como 'completed')
    if (parsed.data.appointmentId) {
      await supabase.from("appointments").update({ status: "completed" }).eq("id", parsed.data.appointmentId);
    }

    revalidatePath("/dashboard/pdv");
    revalidatePath("/equipe/staff"); // Força o Next.js a atualizar o painel do barbeiro
    
    return NextResponse.json({ success: true, orderId: order.id });
  } catch (e) {
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}