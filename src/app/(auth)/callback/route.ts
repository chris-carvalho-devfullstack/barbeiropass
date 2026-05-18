import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = 'edge';
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    
    // Troca o código de acesso por uma sessão válida
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      // FIX DA ARQUITETURA: Atraso de 1 segundo
      // Dá tempo para o seu trigger finalizar e a Read Replica do Supabase sincronizar
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // ============================================================================
      // BLINDAGEM ZERO TRUST: ROTEAMENTO BASEADO NO ESTADO REAL DO BANCO
      // ============================================================================
      
      // 1. Consulta segura da identidade do usuário diretamente no servidor
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (user && !userError) {
        // 2. Verifica se o usuário já possui um vínculo de dono/membro com alguma barbearia
        const { data: existingMember, error: memberError } = await supabase
          .from("barbershop_members")
          .select("id")
          .eq("profile_id", user.id)
          .limit(1)
          .maybeSingle();

        if (memberError) {
          console.error("[SECURITY LOG] Erro ao consultar integridade de vínculos no callback:", memberError);
          return NextResponse.redirect(new URL("/login?error=auth_failed", requestUrl.origin));
        }

        // 3. Tomada de Decisão de Rota
        if (existingMember) {
          // O usuário JÁ POSSUI barbearia. 
          // Bloqueamos qualquer tentativa de ir para a tela de cadastro e forçamos o dashboard.
          return NextResponse.redirect(new URL("/dashboard", requestUrl.origin));
        } else {
          // O usuário NÃO POSSUI barbearia. 
          // Independentemente de onde ele clicou para logar, forçamos o onboarding.
          return NextResponse.redirect(new URL("/cadastro/barbearia", requestUrl.origin));
        }
      }
      
      // ============================================================================
    } else {
      console.error("[SECURITY LOG] Erro na troca de código do Supabase:", error.message);
    }
  }

  // Falha na autenticação ou ausência de código redireciona com aviso de erro
  return NextResponse.redirect(new URL("/login?error=auth_failed", requestUrl.origin));
}