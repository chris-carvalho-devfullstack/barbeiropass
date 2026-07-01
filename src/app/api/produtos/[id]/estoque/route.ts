import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';

export const runtime = 'edge';

// Schema blindado e atualizado
const stockSchema = z.object({
  quantity: z.number(),
  type: z.string(), 
  notes: z.string().optional(),
  barbershop_id: z.string().uuid(),
  reason: z.string().optional(),
  batch_number: z.string().optional(),
  invoice_number: z.string().optional(),
  manufacturing_date: z.string().optional(),
  expiry_date: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Desembrulhamos os cookies e os params corretamente (exigência Next.js 15)
  const [cookieStore, resolvedParams] = await Promise.all([cookies(), params]);
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 401 });

  try {
    const body = await req.json();
    const parsedData = stockSchema.parse(body);

    const { data: newStock, error } = await supabase.rpc('adjust_inventory', {
      p_product_id: resolvedParams.id,
      p_barbershop_id: parsedData.barbershop_id,
      p_user_id: user.id,
      p_quantity: parsedData.quantity,
      p_type: parsedData.type,
      p_notes: parsedData.notes || null,
      p_reason: parsedData.reason || null,
      p_batch_number: parsedData.batch_number || null,
      p_invoice_number: parsedData.invoice_number || null,
      // Se não houver data, passamos explicitamente null para não dar erro no campo DATE
      p_manufacturing_date: parsedData.manufacturing_date ? parsedData.manufacturing_date : null,
      p_expiry_date: parsedData.expiry_date ? parsedData.expiry_date : null,
    });

    if (error) throw error;

    return NextResponse.json({ success: true, newStock });
    
  } catch (error: unknown) {
    console.error('Erro na alteração de estoque:', error);
    const errorMessage = error instanceof Error ? error.message : 'Falha ao processar a alteração de estoque.';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}