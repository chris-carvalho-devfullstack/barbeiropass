import { SupabaseClient } from '@supabase/supabase-js';
import { TenantContext, UserRole } from '@/domain/shared/TenantContext';
import { UnauthorizedError } from '@/domain/shared/errors';

export async function getTenantContext(supabase: SupabaseClient): Promise<TenantContext> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new UnauthorizedError('Usuário não autenticado.');
  }

  const { data: member, error: memberError } = await supabase
    .from('barbershop_members')
    .select('barbershop_id, role, profile_id')
    .eq('profile_id', user.id)
    .single();

  if (memberError || !member || !member.barbershop_id) {
    throw new UnauthorizedError('Perfil de usuário ou vínculo com barbearia não encontrado.');
  }

  return {
    tenantId: member.barbershop_id,
    userId: user.id,
    profileId: member.profile_id,
    role: (member.role as UserRole) || 'receptionist',
  };
}