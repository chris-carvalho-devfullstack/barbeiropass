// src/domain/shared/Repository.ts
import { TenantContext } from './TenantContext';

export interface Repository<Entity, ID = string> {
  findById(context: TenantContext, id: ID): Promise<Entity | null>;
  create(context: TenantContext, data: Partial<Entity>): Promise<Entity>;
  update(context: TenantContext, id: ID, data: Partial<Entity>): Promise<Entity>;
  
  // No BarbeiroPass, usamos Soft Delete, então isso fará um update no deleted_at
  softDelete(context: TenantContext, id: ID): Promise<void>; 
}