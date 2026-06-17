// src/utils/supabase/admin.ts
import { createClient } from '@supabase/supabase-js';
import 'server-only'; // <-- TRAVA DE SEGURANÇA: Impede uso no frontend

/**
 * ATENÇÃO: CLIENTE COM PRIVILÉGIOS ELEVADOS (BYPASS RLS)
 * * Esta função usa a chave SERVICE_ROLE_KEY. 
 * Ela ignora TODAS as políticas de segurança (RLS) do banco de dados.
 * Use APENAS em Server Actions ou Route Handlers (/api) e 
 * SEMPRE valide a permissão do usuário antes de executar qualquer query.
 */
export function createAdminClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('Variável NEXT_PUBLIC_SUPABASE_URL não definida');
  }
  
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Variável SUPABASE_SERVICE_ROLE_KEY não definida. Nunca use NEXT_PUBLIC nesta chave!');
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false, // Como é um super-usuário de API, não precisa de sessão em cookie
      },
    }
  );
}