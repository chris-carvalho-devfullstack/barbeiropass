import { ICustomerRepository } from '../repositories/ICustomerRepository';
import { Customer, CustomerOrigin } from '../entities/Customer';
import { TenantContext } from '../../shared/TenantContext';

export class CustomerService {
  constructor(private readonly repository: ICustomerRepository) {}

  /**
   * Resolve o problema de duplicidade de clientes através de uma hierarquia estrita:
   * 1º Auth ID (Login Google/Apple) -> 2º CPF -> 3º Telefone/Email
   */
  async upsertCustomer(
    context: TenantContext,
    data: Partial<Customer> & { name: string; createdFrom: CustomerOrigin }
  ): Promise<Customer> {
    let existingCustomer: Customer | null = null;

    // 1. Prioridade Máxima: Vínculo de Autenticação (Ex: Google Login)
    if (data.authUserId) {
      existingCustomer = await this.repository.findByAuthId(context, data.authUserId);
    }

    // 2. Prioridade Alta: CPF (Documento Único)
    if (!existingCustomer && data.cpf) {
      existingCustomer = await this.repository.findByCpf(context, data.cpf);
    }

    // 3. Prioridade Média: Telefone ou E-mail
    if (!existingCustomer && (data.phone || data.email)) {
      existingCustomer = await this.repository.findByPhoneOrEmail(context, data.phone, data.email);
    }

    if (existingCustomer) {
      // Tipamos explicitamente como Partial para que o TypeScript permita o 'delete'
      const dataToUpdate: Partial<Customer> = { ...data };
      delete dataToUpdate.createdFrom;

      return this.repository.update(context, existingCustomer.id, {
        ...dataToUpdate,
        updatedAt: new Date(),
      });
    }

    // Se não encontrou nenhuma correspondência, cria um novo cliente
    return this.repository.create(context, {
      ...data,
      status: 'ACTIVE',
      createdAt: new Date(),
    });
  }
}