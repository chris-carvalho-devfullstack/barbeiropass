import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

 export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // next é o redirecionamento após o login (ex: /dashboard)
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Se der erro, redireciona pro login com aviso
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}