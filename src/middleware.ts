import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Executa nas rotas privadas e também na página de login para redirecionar
     * sessões já autenticadas conforme seus papéis.
     * Mantém públicas as páginas de autenticação, a fila pública, o endpoint
     * que resolve o destino e a página de aceitação do convite.
     */
    "/((?!_next/static|_next/image|favicon.ico|b/|api/join-queue|api/public/|api/verify-pin|api/submit-review|api/auth/destination|convite/profissional/aceitar|acesso-negado|cadastro|auth/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
