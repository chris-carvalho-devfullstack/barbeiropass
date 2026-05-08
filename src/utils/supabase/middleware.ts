import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        // A mágica anti-falha de build na Cloudflare:
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setAll(cookiesToSet: any[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Dispara a verificação da sessão
  const { data: { user } } = await supabase.auth.getUser()

  // Regras de Proteção do SaaS Barbeiropass
  const pathname = request.nextUrl.pathname
  
  // Define o que é público (Página inicial, login, cadastro, etc)
  const isPublicRoute = pathname.startsWith('/login') || pathname.startsWith('/cadastro') || pathname === '/'

  // Se o usuário não estiver logado e tentar acessar uma rota protegida (ex: dashboard)
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Se o usuário estiver logado e tentar acessar a página de login, manda pro dashboard
  if (user && pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard' // Ajustaremos essa rota dinamicamente depois para o Tenant
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}