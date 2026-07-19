import { Customer } from '../entities/Customer';
import { TenantContext } from '../../shared/TenantContext';

export interface ICustomerRepository {
  findByAuthId(context: TenantContext, authUserId: string): Promise<Customer | null>;
  findByCpf(context: TenantContext, cpf: string): Promise<Customer | null>;
  findByPhoneOrEmail(context: TenantContext, phone?: string | null, email?: string | null): Promise<Customer | null>;
  create(context: TenantContext, data: Partial<Customer>): Promise<Customer>;
  update(context: TenantContext, id: string, data: Partial<Customer>): Promise<Customer>;
}