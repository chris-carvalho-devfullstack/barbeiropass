export type EntityType = 'CUSTOMER' | 'BOOKING' | 'QUEUE' | 'PDV_ORDER' | 'REVIEW' | 'STAFF' | 'TENANT';

export type EventType =
  | 'CUSTOMER_CREATED'
  | 'CUSTOMER_UPDATED'
  | 'CUSTOMER_MERGED'
  | 'QUEUE_ENTERED'
  | 'QUEUE_LEFT'
  | 'BOOKING_CREATED'
  | 'BOOKING_CANCELLED'
  | 'SERVICE_STARTED'
  | 'SERVICE_FINISHED'
  | 'PAYMENT_COMPLETED'
  | 'PRODUCT_SOLD'
  | 'REVIEW_RECEIVED'
  | 'TAG_ADDED'
  | 'TAG_REMOVED'
  | 'ADMIN_ACTION';

export interface EventLog {
  id: string;
  tenantId: string;
  entityType: EntityType;
  entityId: string;
  eventType: EventType;
  performedBy?: string | null;
  payload?: Record<string, unknown>; // <-- Substituído aqui
  createdAt: Date;
}