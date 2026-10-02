// src/domain/shared/TenantContext.ts

export type UserRole = 'owner' | 'manager' | 'barber' | 'receptionist' | 'public_customer';

export interface TenantContext {
  tenantId: string;       // O barbearia_id
  userId: string | null;  // O auth.uid() do Supabase; nulo para um visitante pÃºblico
  profileId?: string;     // ID do perfil público (se aplicável)
  role: UserRole;         // Papel do usuário logado
  permissions?: string[]; // Permissões granulares (para Fase 7)
  timezone?: string;      // Útil para cálculos de agendamento e PDV
}
