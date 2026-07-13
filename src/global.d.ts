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

// --- TIPAGENS DE AGENDAMENTOS E SERVIÇOS (SUPABASE) ---

export interface Service {
  id: string;
  barbershop_id: string;
  name: string;
  duration_minutes: number;
  price: number;
  commission_percentage?: number | null;
  is_active?: boolean;
  description?: string | null;
  category?: string | null;
  code?: string | null;
  photos?: string[] | null;
}

// Representa a tabela pivô 'appointment_services' retornada em um Join
export interface AppointmentServiceData {
  appointment_id: string;
  service_id: string;
  services: Service; // O Supabase aninha os dados da tabela services aqui
}

export interface Appointment {
  id: string;
  barbershop_id: string;
  barber_id: string;
  client_id?: string | null;
  client_name: string;
  client_phone?: string | null;
  scheduled_at: string;
  status: string;
  created_at?: string;
  
  // A NOVA ESTRUTURA: Um array de serviços da tabela pivô
  appointment_services: AppointmentServiceData[];
}