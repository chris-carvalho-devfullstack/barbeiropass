import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getTenantContext } from '@/infrastructure/tenant/get-tenant-context';
import { CustomerRepository } from '@/infrastructure/database/supabase/CustomerRepository';
import { CustomerService } from '@/domain/customer/services/CustomerService';
import { EventLogRepository } from '@/infrastructure/database/supabase/EventLogRepository';
import { EventLogService } from '@/domain/shared/services/EventLogService';
import { UnauthorizedError } from '@/domain/shared/errors';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = await createClient();

    // 1. Barreira de Segurança: Obter o Contexto do Tenant (Zero Trust)
    const context = await getTenantContext(supabase);

    // 2. Injeção de Dependências (Infraestrutura -> Domínio)
    const customerRepo = new CustomerRepository(supabase);
    const customerService = new CustomerService(customerRepo);
    
    const eventRepo = new EventLogRepository(supabase);
    const eventService = new EventLogService(eventRepo);

    // O ideal é que o frontend envie apenas os números, mas o domínio pode lidar com a limpeza se necessário.
    const cleanPhone = body.phone ? body.phone.replace(/\D/g, '') : null;

    // 3. Regra de Negócio: Smart Merge
    const customer = await customerService.upsertCustomer(context, {
      name: body.name,
      phone: cleanPhone,
      email: body.email,
      createdFrom: 'PDV', // A origem é travada pelo backend
    });

    // 4. Auditoria e Timeline
    await eventService.logEvent(context, {
      entityType: 'CUSTOMER',
      entityId: customer.id,
      eventType: 'CUSTOMER_CREATED',
      payload: { 
        source: 'PDV_QUICK_CREATE', 
        providedPhone: cleanPhone,
        providedEmail: body.email
      }
    });

    // 5. Retorno HTTP à prova de falhas para o Frontend
    return NextResponse.json({ 
      success: true, 
      data: customer,     
      customer: customer, 
      id: customer.id     
    });

  } catch (error: unknown) {
    console.error('Erro na API PDV Quick Client:', error);
    
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json(
      { error: 'Erro interno ao processar cadastro de cliente.' }, 
      { status: 500 }
    );
  }
}