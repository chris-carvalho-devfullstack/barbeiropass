// src/store/use-pdv-store.ts
import { create } from 'zustand';

export type PDVItem = {
  id: string;
  code: string;
  name: string;
  type: 'product' | 'service';
  quantity: number;
  displayPrice: number;
  barberId?: string | null; // <-- ADICIONADO: Elo de ligação com a comissão
};

export type SelectedClient = {
  id?: string;
  name: string;
  document?: string | null;
  phone?: string | null;
  source?: 'walk_in' | 'appointment' | 'queue';
  sourceId?: string | null; // <-- ADICIONADO: Para sabermos qual agendamento/fila finalizar
};

interface PDVState {
  isSaleActive: boolean;
  items: PDVItem[];
  client: SelectedClient | null;
  currentBarberId: string | null; // <-- NOVO: Memória de quem é o barbeiro da sessão atual
  
  startSale: (client?: SelectedClient | null, barberId?: string | null) => void;
  cancelSale: () => void;
  
  addItem: (item: Omit<PDVItem, 'quantity'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  updateItemBarber: (id: string, newBarberId: string | null) => void; // <-- NOVO: Altera o dono da comissão de um item
  clearCart: () => void;
  getCartTotal: () => number;
}

export const usePDVStore = create<PDVState>((set, get) => ({
  isSaleActive: false,
  items: [],
  client: null,
  currentBarberId: null,
  
  startSale: (client = null, barberId = null) => set({ isSaleActive: true, client, items: [], currentBarberId: barberId }),
  cancelSale: () => set({ isSaleActive: false, client: null, items: [], currentBarberId: null }),

  addItem: (newItem) => set((state) => {
    // REGRA DE NEGÓCIO BLINDADA:
    // 1. Se já vier um barberId explícito (ex: da Agenda), respeita.
    // 2. Se for PRODUTO, entra como null (sem comissão), a menos que forçado.
    // 3. Se for SERVIÇO e não tiver dono, usa o barbeiro da sessão como "sugestão".
    let finalBarberId = newItem.barberId;
    
    if (finalBarberId === undefined) {
      if (newItem.type === 'product') {
        finalBarberId = null; 
      } else if (newItem.type === 'service') {
        finalBarberId = state.currentBarberId;
      }
    }

    const itemToMatch = { ...newItem, barberId: finalBarberId };

    // Compara pelo ID e também pelo barberId, para não misturar serviços de barbeiros diferentes no mesmo item
    const existingItemIndex = state.items.findIndex(
      i => i.id === itemToMatch.id && i.barberId === itemToMatch.barberId
    );
    
    if (existingItemIndex >= 0) {
      const newItems = [...state.items];
      newItems[existingItemIndex].quantity += 1;
      return { items: newItems };
    }
    return { items: [...state.items, { ...itemToMatch, quantity: 1 }] };
  }),

  removeItem: (id) => set((state) => ({ items: state.items.filter(i => i.id !== id) })),
  
  updateQuantity: (id, quantity) => set((state) => ({ 
    items: state.items.map(i => i.id === id ? { ...i, quantity: Math.max(1, quantity) } : i) 
  })),

  updateItemBarber: (id, newBarberId) => set((state) => ({
    items: state.items.map(i => i.id === id ? { ...i, barberId: newBarberId } : i)
  })),
  
  clearCart: () => set({ items: [], client: null, isSaleActive: false, currentBarberId: null }),
  
  getCartTotal: () => get().items.reduce((total, item) => total + (item.displayPrice * item.quantity), 0)
}));