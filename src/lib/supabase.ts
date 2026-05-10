import { createBrowserClient } from "@supabase/ssr";

// Usamos fallbacks para evitar que o Cloudflare crashe no momento do Cold Start,
// quando o process.env ainda não foi populado pela requisição.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://placeholder-para-build.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-para-build",
);
