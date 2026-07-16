// src/app/api/perfil/bloqueios/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { z } from "zod";

export const runtime = 'edge';

// Validação estrita do payload de entrada
const blockSchema = z.object({
  block_date: z.string().nullable().optional(), // Nulo significa que repete todos os dias (ex: almoço)
  start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Hora inválida"),
  end_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Hora inválida"),
  type: z.enum(['lunch', 'vacation', 'holiday', 'manual_block']),
  reason: z.string().max(255).optional().nullable(),
});

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { data: staff, error: staffError } = await supabase
      .from("staff")
      .select("id")
      .eq("profile_id", user.id)
      .single();

    if (staffError || !staff) throw new Error("Perfil não encontrado.");

    const { data: bloqueios, error: bloqueiosError } = await supabase
      .from("staff_time_blocks")
      .select("id, block_date, start_time, end_time, type, reason")
      .eq("staff_id", staff.id)
      .order("block_date", { ascending: true, nullsFirst: true }) // Nulos (diários) aparecem primeiro
      .order("start_time", { ascending: true });

    if (bloqueiosError) throw bloqueiosError;

    return NextResponse.json({ data: bloqueios });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await request.json();
    const validation = blockSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({ error: "Dados inválidos", details: validation.error.format() }, { status: 400 });
    }

    const { data: staff, error: staffError } = await supabase
      .from("staff")
      .select("id, barbershop_id")
      .eq("profile_id", user.id)
      .single();

    if (staffError || !staff) throw new Error("Acesso negado.");

    // Injeção segura do staff_id e barbershop_id (Zero Trust)
    const { error: insertError } = await supabase
      .from("staff_time_blocks")
      .insert({
        staff_id: staff.id,
        barbershop_id: staff.barbershop_id,
        block_date: validation.data.block_date || null,
        start_time: validation.data.start_time,
        end_time: validation.data.end_time,
        type: validation.data.type,
        reason: validation.data.reason || null,
      });

    if (insertError) throw new Error("Erro ao criar bloqueio.");

    return NextResponse.json({ success: true, message: "Pausa cadastrada com sucesso." });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const block_id = searchParams.get("id");

    if (!block_id) return NextResponse.json({ error: "ID do bloqueio não fornecido." }, { status: 400 });

    const { data: staff, error: staffError } = await supabase
      .from("staff")
      .select("id")
      .eq("profile_id", user.id)
      .single();

    if (staffError || !staff) throw new Error("Acesso negado.");

    // Deleta garantindo que o bloqueio pertence ao barbeiro logado
    const { error: deleteError } = await supabase
      .from("staff_time_blocks")
      .delete()
      .eq("id", block_id)
      .eq("staff_id", staff.id);

    if (deleteError) throw new Error("Erro ao remover bloqueio.");

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}