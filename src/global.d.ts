// Força o TypeScript a reconhecer importações de arquivos CSS
declare module "*.css" {
  const content: { [className: string]: string };
  export default content;
}

// --- TIPAGENS GLOBAIS DO BANCO DE DADOS (SUPABASE) ---

export interface Barbershop {
  id: string;
  name: string;
  slug: string;
  document?: string | null;
  is_active?: boolean;
  created_at?: string;
  
  // Novos campos do Onboarding Progressivo
  description?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  phone?: string | null;
  instagram?: string | null;
  status?: 'incomplete' | 'pending_review' | 'active' | 'blocked';
  onboarding_score?: number;
}

export interface BarbershopLocation {
  id: string;
  barbershop_id: string;
  zip_code?: string | null;
  street?: string | null;
  number?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  complement?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface BarbershopSettings {
  id: string;
  barbershop_id: string;
  styles?: string[];
  target_audience?: string[];
  amenities?: Record<string, boolean>; // Ex: { wifi: true, beer: false }
  tags?: string[];
  accepts_walk_in?: boolean;
}

export interface BarbershopBusinessHours {
  id: string;
  barbershop_id: string;
  day_of_week: number; // 0 = Domingo, 1 = Segunda...
  open_time?: string | null;
  close_time?: string | null;
  is_closed?: boolean;
}