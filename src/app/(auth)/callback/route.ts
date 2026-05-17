import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      // FIX DA ARQUITETURA: Atraso de 1 segundo
      // Dá tempo para o seu trigger finalizar e a Read Replica do Supabase sincronizar
      await new Promise((resolve) => setTimeout(resolve, 1000));

      return NextResponse.redirect(new URL(next, requestUrl.origin));
    } else {
      console.error("Erro no callback do Supabase:", error.message);
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth_failed", requestUrl.origin));
}