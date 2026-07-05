export const runtime = "edge";

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("📦 PAYLOAD RECEBIDO NA API:", body); // Verifica se os dados chegaram

    const { ledgerId, staffId, oldAmount, newAmount, reason } = body;

    if (!ledgerId || !staffId || oldAmount === undefined || newAmount === undefined || !reason) {
      console.error("❌ Dados incompletos", body);
      return NextResponse.json({ error: "Dados incompletos para auditoria." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { data: member } = await supabase
      .from("barbershop_members")
      .select("barbershop_id, role")
      .eq("profile_id", user.id)
      .single();

    if (!member || (member.role !== "owner" && member.role !== "manager")) {
      return NextResponse.json({ error: "Acesso negado. Apenas gerentes podem auditar." }, { status: 403 });
    }

    const adjustmentAmount = Number(newAmount) - Number(oldAmount);
    if (adjustmentAmount === 0) {
      return NextResponse.json({ error: "O novo valor deve ser diferente do atual." }, { status: 400 });
    }

    // 1. Prioriza o cabeçalho de IP real da Cloudflare, depois os proxies padrão
let ipAddress = req.headers.get("cf-connecting-ip") || 
                req.headers.get("x-forwarded-for") || 
                req.headers.get("x-real-ip") || 
                "Desconhecido";

// 2. Se a requisição vier de múltiplos proxies, pega o primeiro IP da lista
if (ipAddress.includes(",")) {
  ipAddress = ipAddress.split(",")[0].trim();
}

// 3. Amortece o formato visual quando estiver testando em ambiente local (Localhost)
if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
  ipAddress = "127.0.0.1 (Localhost)";
}

    // 1. Tentar inserir no extrato
    console.log("⏳ Inserindo ajuste no staff_financial_ledgers...");
    const { data: ledgerInsert, error: ledgerError } = await supabase
      .from("staff_financial_ledgers")
      .insert({
        staff_id: staffId,
        barbershop_id: member.barbershop_id,
        transaction_type: "audit_adjustment",
        amount: adjustmentAmount,
        description: `Auditoria (Ajuste ref. ao doc ${String(ledgerId).split('-')[0]}): ${reason}`
      })
      .select()
      .single();

    if (ledgerError) {
      console.error("❌ ERRO NO BANCO (staff_financial_ledgers):", ledgerError);
      throw ledgerError;
    }

    // 2. Tentar inserir na tabela de logs
    console.log("⏳ Inserindo log na tabela audit_logs...");
    const { error: auditError } = await supabase
      .from("audit_logs")
      .insert({
        barbershop_id: member.barbershop_id,
        action_type: "financial_audit",
        target_table: "staff_financial_ledgers",
        target_id: ledgerId,
        staff_id: staffId,
        audited_by: user.id,
        old_value: oldAmount,
        new_value: newAmount,
        reason: reason,
        ip_address: ipAddress
      });

    if (auditError) {
      console.error("❌ ERRO NO BANCO (audit_logs):", auditError);
      throw auditError;
    }

    console.log("✅ AUDITORIA CONCLUÍDA COM SUCESSO!");
    return NextResponse.json({ success: true, adjustment: ledgerInsert });

  } catch (error: unknown) {
    console.error("🔥 ERRO FATAL NA ROTA /auditar:", error);
    
    // Tratamento estrito sem usar 'any'
    const errMsg = error instanceof Error ? error.message : "Erro interno no servidor";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}