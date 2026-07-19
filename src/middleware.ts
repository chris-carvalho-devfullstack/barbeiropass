import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * DEFESA EM PROFUNDIDADE (Lista VIP Pública):
     * O Middleware protege TUDO no sistema e força o login, EXCETO:
     * 
     * 1. Arquivos estáticos do sistema Next.js e imagens
     * 2. /b/ -> As páginas públicas das barbearias que os clientes acessam
     * 3. /api/join-queue -> API para entrar na fila (Avulso ou Logado)
     * 4. /api/verify-pin -> API para verificação de PIN no salão
     * 5. /api/submit-review -> API para o cliente avaliar o atendimento
     * 6. Rotas de autenticação (/login, /cadastro, /auth)
     */
    '/((?!_next/static|_next/image|favicon.ico|b/|api/join-queue|api/verify-pin|api/submit-review|login|cadastro|auth/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}