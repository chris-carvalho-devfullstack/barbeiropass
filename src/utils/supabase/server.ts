// src/utils/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Isso ignora erros se o setAll for chamado em Server Components puros,
            // pois o Middleware é quem cuidará de renovar a sessão na prática.
          }
        },
      },
      // ADIÇÃO CRÍTICA PARA A CLOUDFLARE PAGES:
      // Força o Supabase a usar a API de fetch nativa do Edge Runtime
      // em vez de tentar usar bibliotecas legadas do Node.js.
      global: {
        fetch: fetch,
      },
    }
  )
}