import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { z } from "zod";

export const runtime = 'edge';

// 1. Tipagens Estritas Baseadas nos Enums da Base de Dados
const roleSchema = z.enum(["owner", "manager", "barber", "receptionist"]);
const statusSchema = z.enum(["scheduled", "in_progress", "completed", "canceled", "awaiting_payment"]);

// No Next.js, os parâmetros dinâmicos em Route Handlers devem ser tipados como Promise
interface RouteParams {
  params: Promise<{ id: string }>;
}

// ============================================================================
// MÉTODO PATCH: Atualizar o Status do Agendamento (Zero-Trust)
// ============================================================================
export async function PATCH(request: Request, context: RouteParams) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();

    // 1. Autenticação do Utilizador
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    // 2. Validação Estrita do Payload (Body)
    const rawBody = await request.json().catch(() => null);
    const bodyValidation = z.object({
      status: statusSchema,
    }).safeParse(rawBody);

    if (!bodyValidation.success) {
      return NextResponse.json(
        { error: "Status inválido fornecido.", details: bodyValidation.error.format() },
        { status: 400 }
      );
    }

    const novoStatus = bodyValidation.data.status;

    // 3. Zero-Trust: Descobrir cargo do utilizador e a sua barbearia
    const { data: member, error: memberError } = await supabase
      .from("barbershop_members")
      .select("barbershop_id, staff_role_type")
      .eq("profile_id", user.id)
      .single();

    if (memberError || !member) {
      throw new Error("Acesso negado à barbearia.");
    }

    // Identificar nível de acesso
    const roleParse = roleSchema.safeParse(member.staff_role_type);
    const role = roleParse.success ? roleParse.data : "barber";
    const isManagerOrOwner = role === "owner" || role === "manager" || role === "receptionist";

    // 4. Verificação de Propriedade (Acesso Horizontal Mínimo)
    // Precisamos saber se o agendamento pertence a esta barbearia e a quem está atribuído.
    const { data: existingAppt, error: checkError } = await supabase
      .from("appointments")
      .select("barber_id, barbershop_id")
      .eq("id", id)
      .single();

    if (checkError || !existingAppt) {
      return NextResponse.json({ error: "Agendamento não encontrado." }, { status: 404 });
    }

    // Proteção: Ninguém pode alterar dados de outra barbearia
    if (existingAppt.barbershop_id !== member.barbershop_id) {
      return NextResponse.json({ error: "Acesso negado a este registo." }, { status: 403 });
    }

    // Proteção: Se for apenas barbeiro, só altera a própria agenda
    if (!isManagerOrOwner && existingAppt.barber_id !== user.id) {
      return NextResponse.json({ error: "Apenas pode alterar os seus próprios agendamentos." }, { status: 403 });
    }

    // 5. Executar a Atualização Segura
    const { error: updateError } = await supabase
      .from("appointments")
      .update({ status: novoStatus })
      .eq("id", id);

    if (updateError) {
      throw new Error(`Falha ao atualizar na base de dados: ${updateError.message}`);
    }

    return NextResponse.json({ success: true, message: "Status atualizado com sucesso." }, { status: 200 });

  } catch (error: unknown) { // Tratamento livre de "any"
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}