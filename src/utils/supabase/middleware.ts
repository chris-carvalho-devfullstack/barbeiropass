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
  
  // FIX PRINCIPAL AQUI: Adicionamos o '/callback' e o '/b/' na lista de rotas públicas.
  // Isso permite que o código do Google entre na aplicação, crie a sessão e libera a fila pública.
  const isPublicRoute = 
    pathname.startsWith('/login') || 
    pathname.startsWith('/cadastro') || 
    pathname.startsWith('/callback') || 
    pathname.startsWith('/b/') || // <-- ROTA DA FILA PÚBLICA LIBERADA AQUI
    pathname === '/'

  // Se o usuário não estiver logado e tentar acessar uma rota protegida
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Se o usuário estiver logado e tentar acessar a página de login
  if (user && pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard' 
    
    // FIX SECUNDÁRIO: Transfere os cookies da sessão para a resposta de redirecionamento.
    // Impede que tokens renovados (refresh tokens) sejam descartados pelo Next.js.
    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value)
    })
    
    return redirectResponse
  }

  return supabaseResponse
}