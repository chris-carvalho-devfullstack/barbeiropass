import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Desativa otimização nativa que quebra no Edge da Cloudflare
  images: {
    unoptimized: true,
  },
  
  // Ignora avisos do ESLint durante o deploy na nuvem
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Impede que o build falhe por tipagens complexas do Supabase SSR
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;