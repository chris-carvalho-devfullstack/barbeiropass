import { EventLog, EntityType } from '@/domain/shared/events/EventLog';
import { TenantContext } from '@/domain/shared/TenantContext';

export interface IEventLogRepository {
  create(context: TenantContext, event: Omit<EventLog, 'id' | 'tenantId' | 'createdAt'>): Promise<void>;
  findByEntity(context: TenantContext, entityType: EntityType, entityId: string): Promise<EventLog[]>;
}