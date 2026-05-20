import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = 'edge';
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  
  // Captura o parâmetro 'next' (ex: /b/barbearia-do-ze)
  const next = requestUrl.searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    
    // Troca o código de acesso por uma sessão válida apenas UMA vez no servidor
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      // ============================================================================
      // 1. DESVIO PARA CLIENTES (FILA VIRTUAL)
      // ============================================================================
      // Se existe um parâmetro 'next', significa que o login veio de uma página pública (ex: Fila).
      // Redirecionamos o utilizador de volta para lá imediatamente.
      if (next) {
        return NextResponse.redirect(new URL(next, requestUrl.origin));
      }

      // ============================================================================
      // 2. LÓGICA ORIGINAL PARA DONOS DE BARBEARIA
      // ============================================================================
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (user && !userError) {
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

        if (existingMember) {
          return NextResponse.redirect(new URL("/dashboard", requestUrl.origin));
        } else {
          return NextResponse.redirect(new URL("/cadastro/barbearia", requestUrl.origin));
        }
      }
    } else {
      console.error("[SECURITY LOG] Erro na troca de código do Supabase:", error.message);
    }
  }

  // Falha na autenticação ou ausência de código
  return NextResponse.redirect(new URL("/login?error=auth_failed", requestUrl.origin));
}