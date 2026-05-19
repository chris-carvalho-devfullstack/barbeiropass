// src/store/use-pdv-store.ts
import { create } from 'zustand';

export type PDVItem = {
  id: string;
  code: string;
  name: string;
  type: 'product' | 'service';
  quantity: number;
  displayPrice: number;
};

export type SelectedClient = {
  id?: string; // Opcional porque ele pode vir da fila/agenda sem cadastro completo ainda
  name: string;
  document?: string | null;
  phone?: string | null;
  source?: 'walk_in' | 'appointment' | 'queue';
};

interface PDVState {
  isSaleActive: boolean; // Controla se a tela do carrinho está aberta
  items: PDVItem[];
  client: SelectedClient | null;
  
  startSale: (client?: SelectedClient | null) => void;
  cancelSale: () => void;
  
  addItem: (item: Omit<PDVItem, 'quantity'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
}

export const usePDVStore = create<PDVState>((set, get) => ({
  isSaleActive: false,
  items: [],
  client: null,
  
  startSale: (client = null) => set({ isSaleActive: true, client, items: [] }),
  cancelSale: () => set({ isSaleActive: false, client: null, items: [] }),

  addItem: (newItem) => set((state) => {
    const existingItem = state.items.find(i => i.id === newItem.id);
    if (existingItem) {
      return { items: state.items.map(i => i.id === newItem.id ? { ...i, quantity: i.quantity + 1 } : i) };
    }
    return { items: [...state.items, { ...newItem, quantity: 1 }] };
  }),

  removeItem: (id) => set((state) => ({ items: state.items.filter(i => i.id !== id) })),
  updateQuantity: (id, quantity) => set((state) => ({ items: state.items.map(i => i.id === id ? { ...i, quantity: Math.max(1, quantity) } : i) })),
  clearCart: () => set({ items: [], client: null, isSaleActive: false }),
  getCartTotal: () => get().items.reduce((total, item) => total + (item.displayPrice * item.quantity), 0)
}));