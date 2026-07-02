// src/app/(dashboard)/pdv/page.tsx
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { usePDVStore, SelectedClient } from "@/store/use-pdv-store";
import { 
  searchItemsAction, 
  processCheckout, 
  searchClientForPDV, 
  quickCreateClient 
} from "./actions";
import { toast } from "sonner";
import { 
  Barcode, Trash2, CreditCard, Banknote, QrCode, Loader2, 
  Search, Plus, Minus, ShoppingBag, User, Users, CalendarClock, X, UserPlus, Sparkles, Scissors, ChevronRight
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

import { createClient } from "@/utils/supabase/client";

// =========================================================================
// TIPAGENS DE ESTRUTURA E APIs
// =========================================================================
type PaymentMethod = "pix" | "credit_card" | "debit_card" | "cash";

type SuggestedItem = { 
  id: string; 
  name: string; 
  price: number; 
  sku?: string; // Corrigido de code para sku
  barcode?: string; // Adicionado suporte ao código de barras
  type: "product" | "service"; 
};

type ClientSuggestion = {
  id: string;
  name: string;
  document?: string | null;
  phone?: string | null;
};

type PendingService = { id: string; name: string; price: number; };

type PendingClient = {
  id: string;
  clientName: string;
  clientId: string | null;
  barberId: string | null;
  barberName: string | null;
  origin: "queue" | "appointment";
  time: string;
  services: PendingService[]; 
};

type CheckoutContext = {
  sourceId: string | null;
  sourceType: "queue" | "appointment" | null;
};

type StaffMember = {
  id: string;
  full_name: string;
};

export default function PDVPage() {
  
  const { 
    isSaleActive, client, items, startSale, cancelSale, 
    addItem, removeItem, updateQuantity, updateItemBarber, getCartTotal, clearCart 
  } = usePDVStore();
  
  const cartTotal = getCartTotal();

  const [searchInput, setSearchInput] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestedItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  
  const [clientSearch, setClientSearch] = useState("");
  const [clientSuggestions, setClientSuggestions] = useState<ClientSuggestion[]>([]);
  
  const [pendingClients, setPendingClients] = useState<PendingClient[]>([]);
  const [isLoadingPending, setIsLoadingPending] = useState(false);
  const [isSearchingClient, setIsSearchingClient] = useState(false);

  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [checkoutContext, setCheckoutContext] = useState<CheckoutContext>({ sourceId: null, sourceType: null });

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const supabase = createClient();

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const res = await fetch('/api/staff');
        if (res.ok) {
          const data = await res.json();
          if (data.staff) setStaffMembers(data.staff);
        }
      } catch (e) {
        console.error("Erro ao buscar equipe", e);
      }
    };
    fetchStaff();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setSuggestions([]);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isSaleActive && !isSheetOpen) {
      inputRef.current?.focus();
    }
  }, [isSaleActive, isSheetOpen, items]);

  const fetchPendingClients = useCallback(async () => {
    setIsLoadingPending(true);
    try {
      const response = await fetch("/api/pdv/pending-clients");
      if (!response.ok) throw new Error("Falha ao buscar pendentes");
      
      const data = await response.json();
      setPendingClients(data as PendingClient[]);
    } catch (e) {
      console.error("[PDV FETCH ERROR]", e);
      toast.error("Erro ao sincronizar atendimentos pendentes.");
    } finally {
      setIsLoadingPending(false);
    }
  }, []);

  useEffect(() => {
    if (!isSaleActive) {
      fetchPendingClients();

      const channel = supabase
        .channel('pdv-pending-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'virtual_queue' }, () => {
          fetchPendingClients();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
          fetchPendingClients();
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [isSaleActive, fetchPendingClients, supabase]);

  useEffect(() => {
    const delay = setTimeout(async () => {
      if (clientSearch.trim().length >= 3) {
        setIsSearchingClient(true);
        const res = await searchClientForPDV(clientSearch) as { results?: ClientSuggestion[] };
        setClientSuggestions(res?.results || []);
        setIsSearchingClient(false);
      } else {
        setClientSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(delay);
  }, [clientSearch]);

  useEffect(() => {
    const delay = setTimeout(async () => {
      if (searchInput.trim().length >= 2) {
        setIsSearching(true);
        const res = await searchItemsAction(searchInput) as { results?: SuggestedItem[] };
        setSuggestions(res?.results || []);
        setIsSearching(false);
      } else {
        setSuggestions([]);
      }
    }, 150);
    return () => clearTimeout(delay);
  }, [searchInput]);

  const handleStartSale = (
    selectedClient: SelectedClient | null, 
    context?: CheckoutContext, 
    servicesToImport?: { id: string; name: string; price: number; barberId: string | null }[],
    activeBarberId?: string | null
  ) => {
    startSale(selectedClient, activeBarberId);
    
    if (context) setCheckoutContext(context);
    else setCheckoutContext({ sourceId: null, sourceType: null });

    if (servicesToImport && servicesToImport.length > 0) {
      servicesToImport.forEach(svc => {
        const newItem = { 
          id: svc.id, 
          sku: "ATENDIMENTO", 
          name: svc.name, 
          type: "service" as const, 
          displayPrice: svc.price,
          barberId: svc.barberId || activeBarberId || null 
        };
        addItem(newItem as Parameters<typeof addItem>[0]);
      });
      toast.success(`${servicesToImport.length} serviço(s) importado(s) com sucesso.`);
    }

    setClientSearch("");
    setClientSuggestions([]);
  };

  const handleCancelSale = () => {
    cancelSale();
    setCheckoutContext({ sourceId: null, sourceType: null });
  };

  const handleQuickCreateClient = async () => {
    setIsSearchingClient(true);
    const res = await quickCreateClient(clientSearch) as { client?: SelectedClient; error?: string };
    if (res.client) {
      handleStartSale(res.client);
      toast.success("Cliente cadastrado e vinculado na hora!");
    } else {
      toast.error(res.error || "Erro ao cadastrar.");
    }
    setIsSearchingClient(false);
  };

  const selectSuggestedItem = (item: SuggestedItem) => {
    // Agora enviamos sku e barcode perfeitamente mapeados para o Zustand
    addItem({ 
      id: item.id, 
      sku: item.sku, 
      barcode: item.barcode, 
      name: item.name, 
      type: item.type, 
      displayPrice: item.price 
    });
    setSearchInput("");
    setSuggestions([]);
    inputRef.current?.focus();
    toast.success(`${item.name} adicionado ao caixa.`);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (suggestions.length > 0) selectSuggestedItem(suggestions[0]);
  };

  const handleCheckout = async () => {
    if (items.length === 0) return;
    setIsCheckingOut(true);

    const payload = {
      cashRegisterId: "00000000-0000-0000-0000-000000000000",
      paymentMethod,
      clientId: client?.id || null,
      customerName: client?.name || "Cliente Avulso", 
      sourceId: checkoutContext.sourceId,
      sourceType: checkoutContext.sourceType,
      items: items.map(i => {
        const itemWithBarber = i as typeof i & { barberId?: string | null };
        return {
          id: itemWithBarber.id, 
          type: itemWithBarber.type, 
          quantity: itemWithBarber.quantity, 
          barberId: itemWithBarber.barberId || null
        };
      })
    };

    const result = await processCheckout(payload) as { error?: string };
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success("Venda e recebimento concluídos!");
      clearCart();
      setCheckoutContext({ sourceId: null, sourceType: null });
      setIsSheetOpen(false);
    }
    setIsCheckingOut(false);
  };

  const formatTime = (isoDate: string) => {
    return new Date(isoDate).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const queueClients = pendingClients.filter(c => c.origin === "queue");
  const appointmentClients = pendingClients.filter(c => c.origin === "appointment");

  if (!isSaleActive) {
    return (
      <div className="flex flex-col h-[calc(100dvh-2.5rem)] bg-slate-50 md:h-[calc(100vh-3.5rem)] md:m-2 md:rounded-[2rem] md:border md:border-slate-200/60 shadow-sm overflow-hidden relative">
        <header className="px-6 py-8 md:px-10 md:py-8 bg-white border-b border-slate-200/50 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 z-10">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="bg-emerald-100 p-2 rounded-xl">
                <Barcode className="h-6 w-6 text-emerald-600" />
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Caixa Livre</h1>
            </div>
            <p className="text-slate-500 font-medium ml-13">Pronto para iniciar um novo recebimento.</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Banknote className="h-6 w-6 text-blue-600" /> Prontos para Pagamento
                </h2>
                <Badge count={pendingClients.length} />
              </div>

              {isLoadingPending ? (
                <div className="flex flex-col items-center justify-center h-48 bg-white rounded-[2rem] border border-slate-100">
                  <Loader2 className="h-8 w-8 text-blue-600 animate-spin mb-3" />
                  <p className="font-bold text-slate-400">Buscando atendimentos...</p>
                </div>
              ) : pendingClients.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 bg-white rounded-[2rem] border border-dashed border-slate-300 text-center px-6">
                  <div className="bg-slate-50 p-4 rounded-full mb-4">
                    <Sparkles className="h-8 w-8 text-slate-300" />
                  </div>
                  <p className="text-lg font-bold text-slate-500">Nenhum atendimento aguardando caixa.</p>
                  <p className="text-sm text-slate-400 mt-1">Os clientes aparecerão aqui assim que o barbeiro finalizar na cadeira.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in zoom-in-95 duration-300">
                  {queueClients.map(q => (
                    <button 
                      key={q.id} 
                      onClick={() => handleStartSale(
                        { id: q.clientId || undefined, name: q.clientName } as SelectedClient, 
                        { sourceId: q.id, sourceType: "queue" },
                        q.services.map(s => ({ ...s, barberId: q.barberId })), 
                        q.barberId
                      )} 
                      className="flex flex-col text-left bg-white p-5 rounded-[1.5rem] border border-slate-200/70 hover:border-blue-400 hover:ring-4 hover:ring-blue-600/5 transition-all group shadow-sm hover:shadow-md"
                    >
                      <div className="flex items-start justify-between w-full mb-3">
                        <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl">
                          <Users className="h-5 w-5" />
                        </div>
                        <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded-lg uppercase tracking-wider">
                          Fila Virtual
                        </span>
                      </div>
                      <p className="font-black text-lg text-slate-900 leading-tight truncate w-full">{q.clientName}</p>
                      <p className="text-sm text-slate-500 font-medium mt-1 mb-4 flex-1">
                        Atendido por <span className="text-slate-700 font-bold">{q.barberName?.split(" ")[0] || 'Profissional'}</span>
                      </p>
                      
                      {q.services && q.services.length > 0 && (
                        <div className="w-full space-y-1.5 mb-4">
                          {q.services.map(s => (
                            <div key={s.id} className="flex justify-between items-center text-xs text-slate-600 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100">
                              <span className="truncate pr-2 font-medium"><Scissors className="h-3 w-3 inline mr-1 text-slate-400"/> {s.name}</span>
                              <span className="font-bold text-slate-900 shrink-0">R$ {s.price.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="w-full flex items-center justify-between text-blue-600 font-bold text-sm pt-3 border-t border-slate-100 group-hover:text-blue-700">
                        Receber Pagamento <ChevronRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                      </div>
                    </button>
                  ))}

                  {appointmentClients.map(a => (
                    <button 
                      key={a.id} 
                      onClick={() => handleStartSale(
                        { id: a.clientId || undefined, name: a.clientName } as SelectedClient,
                        { sourceId: a.id, sourceType: "appointment" },
                        a.services.map(s => ({ ...s, barberId: a.barberId })),
                        a.barberId
                      )} 
                      className="flex flex-col text-left bg-white p-5 rounded-[1.5rem] border border-slate-200/70 hover:border-purple-400 hover:ring-4 hover:ring-purple-600/5 transition-all group shadow-sm hover:shadow-md"
                    >
                      <div className="flex items-start justify-between w-full mb-3">
                        <div className="bg-purple-50 text-purple-600 p-2.5 rounded-xl">
                          <CalendarClock className="h-5 w-5" />
                        </div>
                        <span className="text-[10px] font-black bg-purple-100 text-purple-800 px-2 py-1 rounded-lg uppercase tracking-wider">
                          {formatTime(a.time)}
                        </span>
                      </div>
                      <p className="font-black text-lg text-slate-900 leading-tight truncate w-full">{a.clientName}</p>
                      <p className="text-sm text-slate-500 font-medium mt-1 mb-4 flex-1">
                        Agendado com <span className="text-slate-700 font-bold">{a.barberName?.split(" ")[0] || 'Profissional'}</span>
                      </p>

                      {a.services && a.services.length > 0 && (
                        <div className="w-full space-y-1.5 mb-4">
                          {a.services.map(s => (
                            <div key={s.id} className="flex justify-between items-center text-xs text-slate-600 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100">
                              <span className="truncate pr-2 font-medium"><Scissors className="h-3 w-3 inline mr-1 text-slate-400"/> {s.name}</span>
                              <span className="font-bold text-slate-900 shrink-0">R$ {s.price.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="w-full flex items-center justify-between text-purple-600 font-bold text-sm pt-3 border-t border-slate-100 group-hover:text-purple-700">
                        Receber Pagamento <ChevronRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <h2 className="text-xl font-black text-slate-900">Novo Atendimento</h2>
              
              <div className="bg-white p-6 rounded-[2rem] border border-slate-200/70 shadow-sm relative">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-3">Buscar Cliente ou Cadastrar</label>
                <div className="relative">
                  <Input 
                    placeholder="Nome, CPF ou Celular..." 
                    value={clientSearch} 
                    onChange={(e) => setClientSearch(e.target.value)} 
                    className="h-14 bg-slate-50 border-slate-200 rounded-xl text-base focus-visible:ring-blue-600/20 px-4" 
                    autoComplete="off"
                  />
                  {isSearchingClient && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-500 animate-spin" />}
                  
                  {clientSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-[110%] bg-white border border-slate-200/80 shadow-xl rounded-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                      {clientSuggestions.map((c) => (
                        <button key={c.id} onClick={() => handleStartSale({ id: c.id, name: c.name, document: c.document, phone: c.phone })} className="w-full text-left p-4 hover:bg-slate-50 border-b border-slate-100 last:border-0 font-bold text-sm text-slate-800 transition-colors">
                          <p className="text-base">{c.name}</p>
                          <p className="text-xs font-normal text-slate-500 font-mono mt-0.5">{c.document || c.phone || 'Sem documento registrado'}</p>
                        </button>
                      ))}
                    </div>
                  )}

                  {clientSearch.length >= 3 && clientSuggestions.length === 0 && !isSearchingClient && (
                    <button onClick={handleQuickCreateClient} className="absolute left-0 right-0 top-[110%] z-50 w-full flex items-center justify-center gap-2 p-4 bg-blue-600 text-white hover:bg-blue-700 rounded-xl font-bold shadow-lg transition-colors animate-in fade-in slide-in-from-top-2">
                      <UserPlus className="h-5 w-5" /> Cadastrar &quot;{clientSearch}&quot;
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-4 py-6">
                  <div className="h-px bg-slate-100 flex-1" />
                  <span className="text-[10px] font-black text-slate-300 uppercase">ou</span>
                  <div className="h-px bg-slate-100 flex-1" />
                </div>

                <Button size="lg" variant="outline" className="w-full h-14 rounded-xl border-slate-200 text-slate-600 font-bold text-base hover:bg-slate-50 hover:text-slate-900 transition-colors" onClick={() => handleStartSale(null)}>
                  <ShoppingBag className="mr-2 h-5 w-5" /> Venda Balcão (Avulso)
                </Button>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-2.5rem)] bg-slate-50 text-slate-900 md:h-[calc(100vh-3.5rem)] md:m-2 md:mt-0.5 md:rounded-2xl md:border md:border-slate-200/80 md:overflow-hidden md:shadow-sm relative transition-all">
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 md:border-r md:border-slate-200/60">
          
          <header className="p-4 border-b border-slate-200/70 flex items-center justify-between bg-white shrink-0 shadow-sm z-20">
            <div className="flex items-center gap-3">
              <div className="bg-slate-100 border border-slate-200 p-2 rounded-xl shadow-sm">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Em Atendimento</p>
                <p className="font-bold text-slate-900 text-lg leading-tight">{client?.name || "Cliente Avulso"}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleCancelSale} className="text-red-500 hover:text-red-600 hover:bg-red-50 font-bold h-10 px-4 rounded-xl transition-colors">
              <X className="h-5 w-5 mr-1" /> Cancelar
            </Button>
          </header>
          
          <div className="p-4 md:p-5 border-b border-slate-200/70 shrink-0 z-10 bg-white shadow-sm relative">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lançar Produtos ou Serviços</span>
            </div>
            
            <form onSubmit={handleFormSubmit} className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
              <Input
                ref={inputRef}
                type="text"
                placeholder="Busque por nome, SKU ou Código de Barras..."
                className="pl-12 h-14 text-base font-medium bg-slate-50 border-slate-200 text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-600/20 focus-visible:border-blue-600 rounded-xl transition-all"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                autoComplete="off"
              />
              {isSearching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-600 h-5 w-5 animate-spin" />}
            </form>

            {suggestions.length > 0 && (
              <div ref={dropdownRef} className="absolute left-4 right-4 top-[5.2rem] bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-100">
                {suggestions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectSuggestedItem(item)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors group"
                  >
                    <div>
                      {/* UI DO DROPDOWN (Busca) COM SKU E BARCODE */}
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${item.type === 'product' ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-800'}`}>
                          {item.type === 'product' ? 'Produto' : 'Serviço'}
                        </span>
                        {item.sku && <span className="text-xs font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">SKU: {item.sku}</span>}
                        {item.barcode && <span className="text-xs font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-1"><Barcode className="w-3 h-3"/> {item.barcode}</span>}
                      </div>
                      <p className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors text-base">{item.name}</p>
                    </div>
                    <span className="font-black text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg text-sm shrink-0 ml-2">
                      {item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 custom-scrollbar relative">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm">
                  <ShoppingBag className="h-10 w-10 text-slate-300" />
                </div>
                <p className="font-bold text-slate-500 text-base">O carrinho está vazio</p>
              </div>
            ) : (
              items.map((item) => (
                <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 md:p-5 bg-white rounded-[1.25rem] border border-slate-200/80 shadow-sm gap-4 hover:border-slate-300 transition-all group animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex-1">
                    
                    {/* UI DO CARRINHO COM SKU E BARCODE */}
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`text-[10px] font-black tracking-wider px-2 py-0.5 rounded-md uppercase ${item.type === 'product' ? 'bg-slate-900 text-white' : 'bg-blue-600 text-white'}`}>
                        {item.type === 'product' ? 'Produto' : 'Serviço'}
                      </span>
                      {item.sku ? (
                        <span className="text-xs text-slate-500 font-mono bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">SKU: {item.sku}</span>
                      ) : item.type === 'product' && (
                        <span className="text-xs text-slate-400 font-mono italic">sem SKU</span>
                      )}
                      {item.barcode && (
                        <span className="text-xs text-slate-500 font-mono bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <Barcode className="w-3 h-3"/> {item.barcode}
                        </span>
                      )}
                    </div>
                    
                    <p className="font-black text-slate-900 text-lg leading-tight mb-2">{item.name}</p>
                    
                    <div className="flex flex-wrap gap-2 items-center">
                      <p className="text-xs text-slate-500 font-medium bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                        Un: {item.displayPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>

                      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md">
                        <Scissors className="h-3.5 w-3.5 text-slate-400" />
                        <select 
                          value={item.barberId || ""} 
                          onChange={(e) => updateItemBarber(item.id, e.target.value || null)}
                          className="text-xs bg-transparent text-slate-700 py-1 font-bold focus:outline-none cursor-pointer max-w-35 truncate"
                        >
                          <option value="">Venda Direta (S/ Com.)</option>
                          {staffMembers.map(staff => (
                            <option key={staff.id} value={staff.id}>
                              {staff.full_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-5 w-full sm:w-auto pt-4 sm:pt-0 border-t border-slate-100 sm:border-0">
                    <div className="flex items-center bg-slate-50 border border-slate-200 p-1 rounded-xl shrink-0">
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-lg hover:bg-white hover:text-blue-600 text-slate-500 hover:shadow-sm transition-all" onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-10 text-center font-black text-base text-slate-800">{item.quantity}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-lg hover:bg-white hover:text-blue-600 text-slate-500 hover:shadow-sm transition-all" onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="font-black text-slate-900 text-xl min-w-20 text-right">
                        {(item.displayPrice * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                      <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-500 hover:bg-red-50 h-10 w-10 rounded-xl shrink-0 transition-colors" onClick={() => removeItem(item.id)}>
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </main>
        </div>

        <div className="hidden md:flex w-100 bg-white flex-col justify-between border-l border-slate-200/80 shadow-[-4px_0_24px_rgba(0,0,0,0.02)] z-20 shrink-0 relative">
          <div className="p-6 md:p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
            
            <div>
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <ShoppingBag className="h-5 w-5 text-blue-600" />
                <h2 className="font-black text-slate-900 text-xl">Resumo do Pedido</h2>
              </div>
              
              <div className="space-y-2 pt-4">
                <div className="flex justify-between text-sm text-slate-500 font-medium">
                  <span>Quantidade de Itens</span>
                  <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">{items.reduce((acc, curr) => acc + curr.quantity, 0)}</span>
                </div>
                <div className="flex justify-between items-end pt-4">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-xs mb-1">Total a Pagar</span>
                  <span className="text-4xl font-black text-slate-900 tracking-tighter">
                    {cartTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Método de Pagamento</span>
              <div className="grid grid-cols-2 gap-3">
                {(["pix", "credit_card", "debit_card", "cash"] as const).map((method) => (
                  <button
                    key={method} type="button" onClick={() => setPaymentMethod(method)}
                    className={`p-4 border-2 font-bold rounded-2xl flex flex-col items-center gap-2 transition-all ${paymentMethod === method ? "border-blue-600 bg-blue-50/50 text-blue-700 shadow-sm ring-4 ring-blue-600/5" : "border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-50"}`}
                  >
                    {method === "pix" && <QrCode className="h-6 w-6" />}
                    {method === "credit_card" && <CreditCard className="h-6 w-6" />}
                    {method === "debit_card" && <CreditCard className="h-6 w-6" />}
                    {method === "cash" && <Banknote className="h-6 w-6" />}
                    <span className="text-sm">{method === "pix" ? "PIX" : method === "cash" ? "Dinheiro" : method === "credit_card" ? "Crédito" : "Débito"}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8 bg-slate-50/50 border-t border-slate-100 shrink-0">
            <Button
              size="lg"
              className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white font-black text-lg rounded-[1rem] shadow-lg shadow-blue-600/20 transition-transform active:scale-[0.98]"
              disabled={items.length === 0 || isCheckingOut}
              onClick={handleCheckout}
            >
              {isCheckingOut ? <Loader2 className="h-6 w-6 animate-spin" /> : "Finalizar Recebimento"}
            </Button>
          </div>
        </div>
      </div>

      <div className="md:hidden shrink-0 p-4 bg-white border-t border-slate-200/80 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] z-20">
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button 
              size="lg" 
              className="w-full h-14 text-base font-extrabold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md active:scale-98"
              disabled={items.length === 0}
            >
              Avançar p/ Pagamento • {cartTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </Button>
          </SheetTrigger>
          
          <SheetContent side="bottom" className="h-[75dvh] bg-slate-50 rounded-t-[2rem] p-0 border-t-0 shadow-2xl flex flex-col overflow-hidden outline-none">
            <SheetHeader className="text-left p-5 bg-white border-b border-slate-100 shrink-0">
              <SheetTitle className="text-2xl font-black text-slate-900">Resumo Final</SheetTitle>
              <div className="flex justify-between items-end pt-2">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-xs mb-1">Total a Pagar</span>
                  <span className="text-3xl font-black text-blue-600 tracking-tighter">
                    {cartTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="space-y-3 pt-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Forma de Recebimento</span>
                <div className="grid grid-cols-2 gap-3">
                  {(["pix", "credit_card", "debit_card", "cash"] as const).map((method) => (
                    <button
                      key={method} type="button" onClick={() => setPaymentMethod(method)}
                      className={`flex flex-col items-center justify-center p-4 border-2 rounded-2xl transition-all ${paymentMethod === method ? "border-blue-600 bg-blue-50 text-blue-700 ring-4 ring-blue-600/5" : "border-slate-200 bg-white text-slate-600"}`}
                    >
                      {method === "pix" && <QrCode className="h-6 w-6 mb-2" />}
                      {method === "credit_card" && <CreditCard className="h-6 w-6 mb-2" />}
                      {method === "debit_card" && <CreditCard className="h-6 w-6 mb-2" />}
                      {method === "cash" && <Banknote className="h-6 w-6 mb-2" />}
                      <span className="font-bold text-sm">{method === "pix" ? "PIX" : method === "cash" ? "Dinheiro" : method === "credit_card" ? "Crédito" : "Débito"}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-5 bg-white border-t border-slate-100 shrink-0">
              <Button 
                size="lg" 
                className="w-full h-16 text-lg font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-[1rem] shadow-lg shadow-emerald-600/20 active:scale-95 transition-transform"
                onClick={handleCheckout}
                disabled={isCheckingOut}
              >
                {isCheckingOut ? <Loader2 className="h-6 w-6 animate-spin" /> : `Confirmar Recebimento`}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

function Badge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <div className="bg-blue-600 text-white text-xs font-black px-2.5 py-0.5 rounded-full shadow-sm">
      {count}
    </div>
  );
}