export const runtime = "edge";

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ledgerId = searchParams.get("ledgerId");

    if (!ledgerId) {
      return NextResponse.json({ error: "ID do lançamento não fornecido." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    // 1. Buscar o lançamento de ajuste na tabela financeira
    const { data: ledger, error: ledgerError } = await supabase
      .from("staff_financial_ledgers")
      .select("*")
      .eq("id", ledgerId)
      .single();

    if (ledgerError || !ledger) {
      return NextResponse.json({ error: "Lançamento de ajuste não encontrado." }, { status: 404 });
    }

    // 2. Extrair o motivo da descrição para garantir o cruzamento de dados seguro
    const reasonMatch = ledger.description?.split("): ");
    const reason = reasonMatch && reasonMatch.length > 1 ? reasonMatch[1] : "";

    // Criar uma janela de tempo segura (1 minuto) para localizar o log exato
    const ledgerTime = new Date(ledger.created_at).getTime();
    const minTime = new Date(ledgerTime - 60000).toISOString();
    const maxTime = new Date(ledgerTime + 60000).toISOString();

    // 3. Buscar o log de auditoria correspondente
    const { data: auditLogs, error: auditError } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("staff_id", ledger.staff_id)
      .gte("created_at", minTime)
      .lte("created_at", maxTime);

    if (auditError || !auditLogs || auditLogs.length === 0) {
      return NextResponse.json({ error: "Registro de log detalhado não localizado." }, { status: 404 });
    }

    const auditLog = auditLogs.find(log => log.reason === reason) || auditLogs[0];

    // 4. Buscar o nome do Gerente/Proprietário que fez a auditoria
    const { data: auditorProfile } = await supabase
      .from("staff")
      .select("full_name, role")
      .eq("profile_id", auditLog.audited_by)
      .limit(1)
      .single();

    // 5. Buscar os dados da transação original vinculada
    let originalLedger = null;
    if (auditLog.target_id) {
      const { data: orig } = await supabase
        .from("staff_financial_ledgers")
        .select("created_at, amount, description, transaction_type")
        .eq("id", auditLog.target_id)
        .single();
      originalLedger = orig;
    }

    return NextResponse.json({
      success: true,
      data: {
        audit_id: auditLog.id,
        created_at: auditLog.created_at,
        ip_address: auditLog.ip_address || "Não rastreado",
        reason: auditLog.reason,
        old_value: auditLog.old_value,
        new_value: auditLog.new_value,
        auditor_name: auditorProfile?.full_name || "Administrador",
        auditor_role: auditorProfile?.role || "Gerência",
        original_transaction: originalLedger
      }
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}