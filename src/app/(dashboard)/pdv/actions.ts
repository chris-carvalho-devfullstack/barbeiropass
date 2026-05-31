// src/app/(dashboard)/pdv/actions.ts
// ATENÇÃO: Sem "use server". Este arquivo roda no cliente e faz chamadas para as novas rotas de API.

// ============================================================================
// TIPAGENS
// ============================================================================

export type PaymentMethod = "pix" | "credit_card" | "debit_card" | "cash";
export type ItemType = "product" | "service";

export interface CheckoutItem {
  id: string;
  type: ItemType;
  quantity: number;
  barberId?: string | null; // Adicionado para rastrear a comissão do profissional
}

export interface CheckoutPayload {
  cashRegisterId: string;
  paymentMethod: PaymentMethod;
  clientId?: string | null;
  appointmentId?: string | null; // Adicionado para dar baixa na agenda automaticamente
  items: CheckoutItem[];
}

// ============================================================================
// FUNÇÕES FETCH (CLIENT-SIDE)
// ============================================================================

export async function processCheckout(payload: CheckoutPayload) {
  try {
    const res = await fetch('/api/pdv/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (error) {
    return { error: "Erro de conexão ao processar checkout" };
  }
}

export async function fetchItemByCode(code: string) {
  const res = await fetch(`/api/pdv/search-items?code=${encodeURIComponent(code)}`);
  return await res.json();
}

export async function searchItemsAction(query: string) {
  if (!query || query.trim().length < 2) return { results: [] };
  const res = await fetch(`/api/pdv/search-items?q=${encodeURIComponent(query)}`);
  return await res.json();
}

export async function searchClientForPDV(query: string) {
  if (!query || query.trim().length < 3) return { results: [] };
  const res = await fetch(`/api/pdv/search-clients?q=${encodeURIComponent(query)}`);
  return await res.json();
}

export async function quickCreateClient(name: string) {
  const res = await fetch('/api/pdv/quick-client', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  return await res.json();
}

export async function getPendingClientsForPDV() {
  const res = await fetch('/api/pdv/pending-clients');
  return await res.json();
}