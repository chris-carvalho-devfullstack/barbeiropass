import { SupabaseClient } from '@supabase/supabase-js';
import { ICustomerRepository } from '@/domain/customer/repositories/ICustomerRepository';
import { Customer } from '@/domain/customer/entities/Customer';
import { TenantContext } from '@/domain/shared/TenantContext';

// Tipagem estrita que reflete exatamente como as colunas estão no PostgreSQL
interface CustomerDbRow {
  id: string;
  barbershop_id: string;
  auth_user_id?: string | null;
  name: string;
  phone?: string | null;
  email?: string | null;
  cpf?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  photo_url?: string | null;
  preferred_barber_id?: string | null;
  marketing_consent: boolean;
  status: string;
  created_from: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export class CustomerRepository implements ICustomerRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Traduz do Formato de Banco de Dados (snake_case) para a Entidade de Domínio (camelCase)
   */
  private mapToDomain(dbRecord: CustomerDbRow): Customer {
    return {
      id: dbRecord.id,
      tenantId: dbRecord.barbershop_id,
      authUserId: dbRecord.auth_user_id,
      name: dbRecord.name,
      phone: dbRecord.phone,
      email: dbRecord.email,
      cpf: dbRecord.cpf,
      birthDate: dbRecord.birth_date ? new Date(dbRecord.birth_date) : null,
      gender: dbRecord.gender,
      photoUrl: dbRecord.photo_url,
      preferredBarberId: dbRecord.preferred_barber_id,
      marketingConsent: dbRecord.marketing_consent,
      status: dbRecord.status as Customer['status'],
      createdFrom: dbRecord.created_from as Customer['createdFrom'],
      createdAt: new Date(dbRecord.created_at),
      updatedAt: new Date(dbRecord.updated_at),
      deletedAt: dbRecord.deleted_at ? new Date(dbRecord.deleted_at) : null,
    };
  }

  /**
   * Traduz da Entidade de Domínio (camelCase) para o Formato do Banco (snake_case)
   */
  private mapToDatabase(domainEntity: Partial<Customer>): Partial<CustomerDbRow> {
    const payload: Partial<CustomerDbRow> = {};

    if (domainEntity.name !== undefined) payload.name = domainEntity.name;
    if (domainEntity.phone !== undefined) payload.phone = domainEntity.phone;
    if (domainEntity.email !== undefined) payload.email = domainEntity.email;
    if (domainEntity.cpf !== undefined) payload.cpf = domainEntity.cpf;
    if (domainEntity.birthDate !== undefined) payload.birth_date = domainEntity.birthDate?.toISOString();
    if (domainEntity.gender !== undefined) payload.gender = domainEntity.gender;
    if (domainEntity.photoUrl !== undefined) payload.photo_url = domainEntity.photoUrl;
    if (domainEntity.preferredBarberId !== undefined) payload.preferred_barber_id = domainEntity.preferredBarberId;
    if (domainEntity.marketingConsent !== undefined) payload.marketing_consent = domainEntity.marketingConsent;
    if (domainEntity.status !== undefined) payload.status = domainEntity.status;
    if (domainEntity.createdFrom !== undefined) payload.created_from = domainEntity.createdFrom;
    if (domainEntity.createdAt !== undefined) payload.created_at = domainEntity.createdAt?.toISOString();
    if (domainEntity.updatedAt !== undefined) payload.updated_at = domainEntity.updatedAt?.toISOString();
    if (domainEntity.deletedAt !== undefined) payload.deleted_at = domainEntity.deletedAt?.toISOString();
    if (domainEntity.authUserId !== undefined) payload.auth_user_id = domainEntity.authUserId;

    return payload;
  }

  async findByAuthId(context: TenantContext, authUserId: string): Promise<Customer | null> {
    const { data } = await this.supabase
      .from('clientes')
      .select('*')
      .eq('barbershop_id', context.tenantId)
      .eq('auth_user_id', authUserId)
      .is('deleted_at', null)
      .single();
    
    return data ? this.mapToDomain(data as CustomerDbRow) : null;
  }

  async findByCpf(context: TenantContext, cpf: string): Promise<Customer | null> {
    const { data } = await this.supabase
      .from('clientes')
      .select('*')
      .eq('barbershop_id', context.tenantId)
      .eq('cpf', cpf)
      .is('deleted_at', null)
      .single();
      
    return data ? this.mapToDomain(data as CustomerDbRow) : null;
  }

  async findByPhoneOrEmail(context: TenantContext, phone?: string | null, email?: string | null): Promise<Customer | null> {
    if (!phone && !email) return null;

    let query = this.supabase
      .from('clientes')
      .select('*')
      .eq('barbershop_id', context.tenantId)
      .is('deleted_at', null);

    if (phone && email) {
      query = query.or(`phone.eq.${phone},email.eq.${email}`);
    } else if (phone) {
      query = query.eq('phone', phone);
    } else if (email) {
      query = query.eq('email', email);
    }

    const { data } = await query.limit(1).maybeSingle();
    return data ? this.mapToDomain(data as CustomerDbRow) : null;
  }

  async create(context: TenantContext, data: Partial<Customer>): Promise<Customer> {
    // Mesclamos o objeto processado pelo nosso mapeador com a chave de segurança
    const dbPayload = {
      ...this.mapToDatabase(data),
      barbershop_id: context.tenantId, // Força a segurança (Zero Trust)
    };

    const { data: result, error } = await this.supabase
      .from('clientes')
      .insert(dbPayload)
      .select()
      .single();
      
    if (error) throw new Error(`Erro ao criar cliente no Supabase: ${error.message}`);
    return this.mapToDomain(result as CustomerDbRow);
  }

  async update(context: TenantContext, id: string, data: Partial<Customer>): Promise<Customer> {
    const dbPayload = this.mapToDatabase(data);

    const { data: result, error } = await this.supabase
      .from('clientes')
      .update(dbPayload)
      .eq('id', id)
      .eq('barbershop_id', context.tenantId)
      .select()
      .single();

    if (error) throw new Error(`Erro ao atualizar cliente no Supabase: ${error.message}`);
    return this.mapToDomain(result as CustomerDbRow);
  }
}