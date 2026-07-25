// src/app/(auth)/callback/route.ts
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js"; // IMPORTANTE PARA O VÍNCULO

export const runtime = 'edge';
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next");

  if (code) {
    const supabase = await createServerClient();
    
    // Troca o código de acesso por uma sessão válida apenas UMA vez no servidor
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {

      // ============================================================================
      // 0. MÁGICA DA CONVERSÃO PLG (VÍNCULO DO AVULSO COM A NOVA CONTA)
      // ============================================================================
      let finalRedirectUrl = next || "/";

      if (next && next.includes('link_queue=')) {
        // Extrai o ID da fila da URL enviada pelo front-end
        const nextUrlObj = new URL(next, requestUrl.origin);
        const queueId = nextUrlObj.searchParams.get('link_queue');

        if (queueId) {
          // Pega o usuário que acabou de nascer no sistema (login do Google)
          const { data: { user } } = await supabase.auth.getUser();

          if (user) {
            // Como o ticket era de um anônimo, a RLS do banco pode bloquear a adoção.
            // Usamos a chave Admin para garantir que o vínculo seja feito com força bruta.
            const supabaseAdmin = createAdminClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY!
            );

            const { error: updateError } = await supabaseAdmin
              .from('virtual_queue')
              .update({ client_auth_id: user.id })
              .eq('id', queueId)
              .is('client_auth_id', null); // Segurança extra: só vincula se a ficha estiver órfã

            if (updateError) {
              console.error("[PLG CONVERSION ERROR] Falha ao vincular ticket:", updateError);
            }
          }

          // Limpa o parâmetro da URL para deixá-la bonita e sem rastros para o cliente
          nextUrlObj.searchParams.delete('link_queue');
          finalRedirectUrl = nextUrlObj.pathname + nextUrlObj.search;
        }
      }

      // ============================================================================
      // 1. ROTEAMENTO DE CLIENTES (WHITELIST)
      // ============================================================================
      // Agora usamos a 'finalRedirectUrl', que já está limpa e sem o 'link_queue'
      const isClientRoute = finalRedirectUrl.startsWith('/b/');

      if (isClientRoute) {
        return NextResponse.redirect(new URL(finalRedirectUrl, requestUrl.origin));
      }

      // ============================================================================
      // 2. ROTEAMENTO INTELIGENTE PARA DONOS (SINGLE SOURCE OF TRUTH)
      // ============================================================================
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (user && !userError) {
        // A decisão do destino final é tomada pelo banco de dados, ignorando a URL
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

        // Se já existe vínculo, é um Login normal -> Vai pro Dashboard
        if (existingMember) {
          return NextResponse.redirect(new URL("/dashboard", requestUrl.origin));
        } 
        // Se não existe vínculo, é um Cadastro novo -> Vai pro Onboarding da Barbearia
        else {
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