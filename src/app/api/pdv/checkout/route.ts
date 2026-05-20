import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const checkoutSchema = z.object({
  cashRegisterId: z.string().uuid("Caixa inválido"),
  paymentMethod: z.enum(["pix", "credit_card", "debit_card", "cash"]),
  clientId: z.string().uuid().optional().nullable(),
  items: z.array(z.object({
    id: z.string().uuid(),
    type: z.enum(["product", "service"]),
    quantity: z.number().min(1)
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

    for (const item of parsed.data.items) {
      let unitPrice = 0;

      if (item.type === "product") {
        const { data: product } = await supabase.from("products").select("price, stock_quantity").eq("id", item.id).eq("barbershop_id", member.barbershop_id).single();
        if (!product) return NextResponse.json({ error: `Produto inválido: ${item.id}` }, { status: 400 });
        if (product.stock_quantity < item.quantity) return NextResponse.json({ error: "Estoque insuficiente." }, { status: 400 });
        
        unitPrice = product.price;
        await supabase.from("products").update({ stock_quantity: product.stock_quantity - item.quantity }).eq("id", item.id);
      } else if (item.type === "service") {
        const { data: service } = await supabase.from("services").select("price").eq("id", item.id).eq("barbershop_id", member.barbershop_id).single();
        if (!service) return NextResponse.json({ error: `Serviço inválido: ${item.id}` }, { status: 400 });
        unitPrice = service.price;
      }

      realTotalAmount += (unitPrice * item.quantity);
      orderItemsToInsert.push({
        item_type: item.type, product_id: item.type === "product" ? item.id : null, service_id: item.type === "service" ? item.id : null,
        quantity: item.quantity, unit_price: unitPrice, commission_amount: 0
      });
    }

    const { data: order, error: orderError } = await supabase.from("pos_orders").insert({
      barbershop_id: member.barbershop_id, cash_register_id: parsed.data.cashRegisterId, customer_id: parsed.data.clientId || null,
      total_amount: realTotalAmount, payment_method: parsed.data.paymentMethod
    }).select("id").single();

    if (orderError) return NextResponse.json({ error: "Erro ao registrar a venda." }, { status: 500 });

    const itemsComOrderId = orderItemsToInsert.map(i => ({ ...i, order_id: order.id }));
    const { error: itemsError } = await supabase.from("pos_order_items").insert(itemsComOrderId);
    if (itemsError) return NextResponse.json({ error: "Erro ao salvar os itens da venda." }, { status: 500 });

    revalidatePath("/dashboard/pdv");
    return NextResponse.json({ success: true, orderId: order.id });
  } catch (e) {
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}