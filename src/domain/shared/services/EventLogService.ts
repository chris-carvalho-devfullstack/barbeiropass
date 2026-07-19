import { IEventLogRepository } from '@/domain/shared/repositories/IEventLogRepository';
import { TenantContext } from '@/domain/shared/TenantContext';
import { EntityType, EventType } from '@/domain/shared/events/EventLog';

export class EventLogService {
  constructor(private readonly repository: IEventLogRepository) {}

  /**
   * Registra uma ação no sistema, mascarando dados sensíveis antes de salvar no banco.
   */
  async logEvent(
    context: TenantContext,
    params: {
      entityType: EntityType;
      entityId: string;
      eventType: EventType;
      performedBy?: string;
      payload?: Record<string, unknown>;
    }
  ): Promise<void> {
    
    // LGPD / Segurança: Removemos dados super sensíveis antes de salvar no Payload JSON
    const safePayload = { ...params.payload } as Record<string, unknown>;
    
    // Como usamos 'unknown', o TypeScript exige que verifiquemos a chave antes de alterá-la
    if ('password' in safePayload) {
      delete safePayload.password;
    }
    if ('credit_card' in safePayload) {
      safePayload.credit_card = '***';
    }

    await this.repository.create(context, {
      entityType: params.entityType,
      entityId: params.entityId,
      eventType: params.eventType,
      performedBy: params.performedBy || context.userId,
      payload: safePayload,
    });
  }

  /**
   * Gera a linha do tempo (Timeline) para o painel 360º do CRM.
   */
  async getCustomerTimeline(context: TenantContext, customerId: string) {
     return this.repository.findByEntity(context, 'CUSTOMER', customerId);
  }
}