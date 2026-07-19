import { SupabaseClient } from '@supabase/supabase-js';
import { IEventLogRepository } from '@/domain/shared/repositories/IEventLogRepository';
import { EventLog, EntityType, EventType } from '@/domain/shared/events/EventLog';
import { TenantContext } from '@/domain/shared/TenantContext';

export class EventLogRepository implements IEventLogRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(context: TenantContext, event: Omit<EventLog, 'id' | 'tenantId' | 'createdAt'>): Promise<void> {
    const { error } = await this.supabase
      .from('event_log')
      .insert({
        barbershop_id: context.tenantId,
        entity_type: event.entityType,
        entity_id: event.entityId,
        event_type: event.eventType,
        // Fallback de segurança: se não for informado quem fez a ação, assume o usuário logado no contexto
        performed_by: event.performedBy || context.userId, 
        payload: event.payload || {}
      });

    if (error) {
      // Falhas no log de auditoria são críticas para a arquitetura Zero Trust.
      throw new Error(`Erro de auditoria ao registrar evento ${event.eventType}: ${error.message}`);
    }
  }

  async findByEntity(context: TenantContext, entityType: EntityType, entityId: string): Promise<EventLog[]> {
    const { data, error } = await this.supabase
      .from('event_log')
      .select('*')
      .eq('barbershop_id', context.tenantId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar histórico de eventos: ${error.message}`);
    }

    return (data || []).map(item => ({
      id: item.id,
      tenantId: item.barbershop_id,
      entityType: item.entity_type as EntityType,
      entityId: item.entity_id,
      eventType: item.event_type as EventType,
      performedBy: item.performed_by,
      // Forçamos a tipagem segura exigida pela entidade sem usar o "any"
      payload: item.payload as Record<string, unknown>, 
      createdAt: new Date(item.created_at)
    }));
  }
}