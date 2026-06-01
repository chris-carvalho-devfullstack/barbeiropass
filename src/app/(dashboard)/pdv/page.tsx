// src/app/(dashboard)/pdv/page.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import { usePDVStore, SelectedClient } from "@/store/use-pdv-store";
import { 
  searchItemsAction, 
  processCheckout, 
  searchClientForPDV, 
  getPendingClientsForPDV, 
  quickCreateClient 
} from "./actions";
import { toast } from "sonner";
import { 
  Barcode, Trash2, CreditCard, Banknote, QrCode, Loader2, 
  Search, Plus, Minus, ShoppingBag, User, Users, CalendarClock, ArrowRight, X, UserPlus, Sparkles, Scissors
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// IMPORT: Supabase Client para buscar a lista de barbeiros (Comissão Fracionada)
import { createClient } from "@/utils/supabase/client";

// =========================================================================
// TIPAGENS DE ESTRUTURA E APIs
// =========================================================================
type PaymentMethod = "pix" | "credit_card" | "debit_card" | "cash";

type SuggestedItem = { 
  id: string; 
  name: string; 
  price: number; 
  code: string; 
  type: "product" | "service"; 
};

type ClientSuggestion = {
  id: string;
  name: string;
  document?: string | null;
  phone?: string | null;
};

type PendingClient = {
  id: string;
  clientName: string;
  clientId: string | null;
  barberId: string | null;
  barberName: string | null;
  origin: "queue" | "appointment";
  time: string;
  serviceId?: string | null;
  serviceName?: string | null;
  servicePrice?: number | null;
};

type CheckoutContext = {
  sourceId: string | null;
  sourceType: "queue" | "appointment" | null;
};

// Tipagem para os membros da equipe (Barbeiros)
type StaffMember = {
  id: string;
  full_name: string;
};

export default function PDVPage() {
  // =========================================================================
  // ESTADOS GLOBAIS (ZUSTAND) E LOCAIS
  // =========================================================================
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
  
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [clientSuggestions, setClientSuggestions] = useState<ClientSuggestion[]>([]);
  
  const [pendingClients, setPendingClients] = useState<PendingClient[]>([]);
  const [isLoadingPending, setIsLoadingPending] = useState(false);
  const [isSearchingClient, setIsSearchingClient] = useState(false);

  // Estado para armazenar a lista de barbeiros para o Select
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);

  const [checkoutContext, setCheckoutContext] = useState<CheckoutContext>({ sourceId: null, sourceType: null });

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // =========================================================================
  // EFEITOS E BUSCAS
  // =========================================================================
  
  // Busca os barbeiros ativos da barbearia para popular o Dropdown do carrinho
  useEffect(() => {
    const fetchStaff = async () => {
      const supabase = createClient();
      const { data } = await supabase.from('staff').select('id, full_name').eq('is_active', true);
      if (data) setStaffMembers(data);
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
    if (isSaleActive && !isSheetOpen && !isStartModalOpen) {
      inputRef.current?.focus();
    }
  }, [isSaleActive, isSheetOpen, isStartModalOpen, items]);

  useEffect(() => {
    if (isStartModalOpen) {
      setIsLoadingPending(true);
      getPendingClientsForPDV().then((res: unknown) => {
        const responseData = res as Record<string, unknown>;
        if (!responseData.error) {
          setPendingClients(res as PendingClient[]);
        }
        setIsLoadingPending(false);
      }).catch(() => {
        setIsLoadingPending(false);
      });
    }
  }, [isStartModalOpen]);

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

  // =========================================================================
  // AÇÕES DO USUÁRIO
  // =========================================================================
  const handleStartSale = (
    selectedClient: SelectedClient | null, 
    context?: CheckoutContext, 
    autoService?: { id: string; name: string; price: number; barberId: string | null },
    activeBarberId?: string | null
  ) => {
    startSale(selectedClient, activeBarberId);
    
    if (context) {
      setCheckoutContext(context);
    } else {
      setCheckoutContext({ sourceId: null, sourceType: null });
    }

    if (autoService) {
      const newItem = { 
        id: autoService.id, 
        code: "AGENDADO", 
        name: autoService.name, 
        type: "service" as const, 
        displayPrice: autoService.price,
        barberId: autoService.barberId || activeBarberId || null 
      };
      
      addItem(newItem as Parameters<typeof addItem>[0]);
      toast.success(`${autoService.name} adicionado automaticamente.`);
    }

    setIsStartModalOpen(false);
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
    addItem({ id: item.id, code: item.code, name: item.name, type: item.type, displayPrice: item.price });
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
      customerName: client?.name || "Cliente Avulso", // <--- ARQUITETURA BLINDADA (PASSO 3)
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

  // =========================================================================
  // RENDERIZAÇÃO: TELA 1 (OCIOSA / TOTEM)
  // =========================================================================
  if (!isSaleActive) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100dvh-2.5rem)] bg-slate-50 md:h-[calc(100vh-3.5rem)] md:m-2 md:rounded-2xl md:border md:border-slate-200 shadow-sm relative">
        <div className="text-center max-w-sm w-full p-6 space-y-6">
          <div className="mx-auto w-24 h-24 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shadow-inner">
            <Barcode className="w-12 h-12" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900">Caixa Livre</h1>
            <p className="text-slate-500 font-medium mt-2">Toque abaixo para iniciar um atendimento.</p>
          </div>
          <Button 
            size="lg" 
            className="w-full h-16 text-xl font-bold rounded-2xl bg-blue-600 hover:bg-blue-700 shadow-lg transition-transform active:scale-95"
            onClick={() => setIsStartModalOpen(true)}
          >
            Nova Venda
          </Button>
        </div>

        <Dialog open={isStartModalOpen} onOpenChange={setIsStartModalOpen}>
          <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-slate-50 rounded-3xl border-0 shadow-2xl">
            <DialogHeader className="p-6 bg-white border-b border-slate-100 text-left">
              <DialogTitle className="text-2xl font-black text-slate-900">Identificação</DialogTitle>
              <p className="text-sm text-slate-500 font-medium">Quem você vai atender agora?</p>
            </DialogHeader>

            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
              {(!isLoadingPending && pendingClients.length > 0) && (
                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Prontos para Pagamento</span>
                  <div className="grid gap-2">
                    
                    {/* Lista da Fila Virtual */}
                    {queueClients.map(q => (
                      <button 
                        key={q.id} 
                        onClick={() => handleStartSale(
                          { id: q.clientId || undefined, name: q.clientName } as SelectedClient, 
                          { sourceId: q.id, sourceType: "queue" },
                          undefined,
                          q.barberId // <--- Envia o ID para a Store
                        )} 
                        className="flex items-center justify-between p-3 bg-white border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors text-left group shadow-sm hover:shadow"
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-blue-100 text-blue-600 p-2.5 rounded-xl"><Users className="h-5 w-5" /></div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-slate-900 leading-tight">{q.clientName}</p>
                              <span className="flex items-center gap-1.5 text-[10px] font-black bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md uppercase tracking-wider border border-emerald-200">
                                <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-600"></span></span>
                                Caixa Livre
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1 font-medium">
                              Fila Virtual {q.barberName ? `• Por ${q.barberName.split(" ")[0]}` : ''}
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-blue-600 transition-transform group-hover:translate-x-1" />
                      </button>
                    ))}

                    {/* Lista de Agendamentos */}
                    {appointmentClients.map(a => (
                      <button 
                        key={a.id} 
                        onClick={() => handleStartSale(
                          { id: a.clientId || undefined, name: a.clientName } as SelectedClient,
                          { sourceId: a.id, sourceType: "appointment" },
                          (a.serviceId && a.servicePrice != null) 
                            ? { id: a.serviceId, name: a.serviceName || "Serviço", price: Number(a.servicePrice), barberId: a.barberId } 
                            : undefined,
                          a.barberId // <--- Envia o ID para a Store
                        )} 
                        className="flex items-center justify-between p-3 bg-white border border-purple-200 rounded-xl hover:bg-purple-50 transition-colors text-left group shadow-sm hover:shadow"
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-purple-100 text-purple-600 p-2.5 rounded-xl"><CalendarClock className="h-5 w-5" /></div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-slate-900 leading-tight">{a.clientName}</p>
                              <span className="text-[10px] font-black bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded-md uppercase tracking-wider border border-purple-200">
                                {formatTime(a.time)}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1 font-medium flex items-center gap-1">
                              Agendado {a.barberName ? `• Por ${a.barberName.split(" ")[0]}` : ''} 
                              {a.serviceName && <span className="flex items-center gap-0.5"><Scissors className="h-3 w-3 inline" /> {a.serviceName}</span>}
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-purple-600 transition-transform group-hover:translate-x-1" />
                      </button>
                    ))}

                  </div>
                </div>
              )}

              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Buscar ou Cadastrar</span>
                <div className="relative">
                  <Input 
                    placeholder="CPF, Telefone ou Nome..." 
                    value={clientSearch} 
                    onChange={(e) => setClientSearch(e.target.value)} 
                    className="h-12 bg-white border-slate-200 shadow-sm rounded-xl text-base focus-visible:ring-blue-600/20" 
                    autoComplete="off"
                  />
                  {isSearchingClient && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500 animate-spin" />}
                  
                  {clientSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-[110%] bg-white border border-slate-200 shadow-xl rounded-xl z-50 overflow-hidden">
                      {clientSuggestions.map((c) => (
                        <button key={c.id} onClick={() => handleStartSale({ id: c.id, name: c.name, document: c.document, phone: c.phone })} className="w-full text-left p-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 font-bold text-sm text-slate-800 transition-colors">
                          <p>{c.name}</p>
                          <p className="text-xs font-normal text-slate-500 font-mono">{c.document || c.phone || 'Sem documento'}</p>
                        </button>
                      ))}
                    </div>
                  )}

                  {clientSearch.length >= 3 && clientSuggestions.length === 0 && !isSearchingClient && (
                    <button onClick={handleQuickCreateClient} className="absolute left-0 right-0 top-[110%] z-50 w-full flex items-center justify-center gap-2 p-3 bg-blue-600 text-white hover:bg-blue-700 rounded-xl font-bold text-sm shadow-lg transition-colors">
                      <UserPlus className="h-4 w-4" /> Cadastrar &quot;{clientSearch}&quot;
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 bg-white border-t border-slate-100">
              <Button size="lg" variant="outline" className="w-full h-14 rounded-xl border-slate-200 text-slate-600 font-bold text-base hover:bg-slate-50 hover:text-slate-900 transition-colors" onClick={() => handleStartSale(null)}>
                Atender Cliente Avulso
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // =========================================================================
  // RENDERIZAÇÃO: TELA 2 (PDV ATIVO)
  // =========================================================================
  return (
    <div className="flex flex-col h-[calc(100dvh-2.5rem)] bg-slate-50 text-slate-900 md:h-[calc(100vh-3.5rem)] md:m-2 md:mt-0.5 md:rounded-2xl md:border md:border-slate-200/80 md:overflow-hidden md:shadow-sm relative transition-all">
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* COLUNA ESQUERDA: BARRA DE PESQUISA E ITENS */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white md:border-r md:border-slate-200/60">
          
          <header className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
            <div className="flex items-center gap-3">
              <div className="bg-white border border-slate-200 p-2 rounded-xl shadow-sm">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase">Em Atendimento</p>
                <p className="font-bold text-slate-900 leading-tight">{client?.name || "Cliente Avulso"}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleCancelSale} className="text-red-500 hover:text-red-600 hover:bg-red-50 font-bold h-9 rounded-lg transition-colors">
              <X className="h-4 w-4 mr-1" /> Cancelar
            </Button>
          </header>
          
          <div className="p-4 border-b border-slate-100 relative shrink-0 z-10 bg-white">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-blue-600 animate-pulse" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Adicionar Itens</span>
            </div>
            
            <form onSubmit={handleFormSubmit} className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
              <Input
                ref={inputRef}
                type="text"
                placeholder="Leia o código ou busque pelo nome..."
                className="pl-12 h-14 text-base font-medium bg-slate-50 border-slate-200 text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-600/20 focus-visible:border-blue-600 rounded-xl shadow-inner transition-all"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                autoComplete="off"
              />
              {isSearching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-600 h-5 w-5 animate-spin" />}
            </form>

            {suggestions.length > 0 && (
              <div ref={dropdownRef} className="absolute left-4 right-4 top-[5.2rem] bg-white border border-slate-200/80 rounded-2xl shadow-xl z-50 overflow-hidden max-h-64 overflow-y-auto backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-100">
                {suggestions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectSuggestedItem(item)}
                    className="w-full flex items-center justify-between p-3.5 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors group"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${item.type === 'product' ? 'bg-amber-50 text-amber-700 border border-amber-200/60' : 'bg-purple-50 text-purple-700 border border-purple-200/60'}`}>
                          {item.type === 'product' ? 'PRODUTO' : 'SERVIÇO'}
                        </span>
                        {item.code && <span className="text-xs font-mono text-slate-400">{item.code}</span>}
                      </div>
                      <p className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{item.name}</p>
                    </div>
                    <span className="font-extrabold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg text-sm">
                      {item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <main className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/40 shadow-sm">
                  <Barcode className="h-8 w-8 text-slate-300" />
                </div>
                <p className="font-semibold text-slate-500 text-sm">Aguardando inserção de itens</p>
              </div>
            ) : (
              items.map((item) => (
                <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white rounded-2xl border border-slate-200/60 shadow-sm gap-3 hover:border-slate-300 transition-all group">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[9px] font-extrabold tracking-wider px-1.5 py-0.5 rounded-md ${item.type === 'product' ? 'bg-slate-900 text-white' : 'bg-blue-600 text-white'}`}>
                        {item.type === 'product' ? 'PRODUTO' : 'SERVIÇO'}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">{item.code || 'sem SKU'}</span>
                    </div>
                    <p className="font-extrabold text-slate-800 text-base leading-snug">{item.name}</p>
                    
                    <div className="mt-1 space-y-2">
                      <p className="text-xs text-slate-400 font-medium">
                        Unidade: {item.displayPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>

                      {/* SELECT PARA ESCOLHA/ALTERAÇÃO DO BARBEIRO NO SERVIÇO */}
                      {item.type === 'service' && (
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          <select 
                            value={item.barberId || ""} 
                            onChange={(e) => updateItemBarber(item.id, e.target.value || null)}
                            className="text-xs bg-slate-100/80 border border-slate-200 text-slate-700 py-1 px-2 rounded-lg font-bold hover:bg-slate-200/50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600/20 cursor-pointer max-w-[180px] truncate"
                          >
                            <option value="">Venda da Casa (S/ Comissão)</option>
                            {staffMembers.map(staff => (
                              <option key={staff.id} value={staff.id}>
                                {staff.full_name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto pt-3 sm:pt-0 border-t border-slate-50 sm:border-0">
                    <div className="flex items-center bg-slate-50 border border-slate-200/80 p-1 rounded-xl shrink-0">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white hover:text-blue-600 text-slate-500 active:scale-95" onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-9 text-center font-black text-sm text-slate-800">{item.quantity}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white hover:text-blue-600 text-slate-500 active:scale-95" onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-black text-slate-900 text-base min-w-20 text-right">
                        {(item.displayPrice * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                      <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-500 hover:bg-red-50 h-9 w-9 rounded-xl shrink-0 transition-colors" onClick={() => removeItem(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </main>
        </div>

        {/* COLUNA DIREITA (DESKTOP) */}
        <div className="hidden md:flex w-85 bg-white flex-col justify-between p-6 border-l border-slate-100">
          <div className="space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <ShoppingBag className="h-5 w-5 text-slate-800" />
              <h2 className="font-black text-slate-800 text-lg">Resumo</h2>
            </div>
            
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm text-slate-400 font-medium">
                <span>Itens inclusos</span>
                <span>{items.reduce((acc, curr) => acc + curr.quantity, 0)}</span>
              </div>
              <div className="flex justify-between text-xl font-black text-slate-900 pt-2">
                <span>Total</span>
                <span>{cartTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Forma de Recebimento</span>
              <div className="grid grid-cols-2 gap-2">
                {(["pix", "credit_card", "debit_card", "cash"] as const).map((method) => (
                  <button
                    key={method} type="button" onClick={() => setPaymentMethod(method)}
                    className={`p-3 border text-xs font-bold rounded-xl flex flex-col items-center gap-1.5 transition-all ${paymentMethod === method ? "border-blue-600 bg-blue-50/60 text-blue-700 shadow-sm" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                  >
                    {method === "pix" && <QrCode className="h-4 w-4" />}
                    {method === "credit_card" && <CreditCard className="h-4 w-4" />}
                    {method === "debit_card" && <CreditCard className="h-4 w-4" />}
                    {method === "cash" && <Banknote className="h-4 w-4" />}
                    {method === "pix" ? "PIX" : method === "cash" ? "Dinheiro" : method === "credit_card" ? "Crédito" : "Débito"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Button
            size="lg"
            className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base rounded-xl shadow-md transition-transform active:scale-95"
            disabled={items.length === 0 || isCheckingOut}
            onClick={handleCheckout}
          >
            {isCheckingOut ? <Loader2 className="h-5 w-5 animate-spin" /> : "Concluir Venda"}
          </Button>
        </div>
      </div>

      {/* PAINEL INFERIOR DA GAVETA (MOBILE APENAS) */}
      <div className="md:hidden shrink-0 p-4 bg-white border-t border-slate-200/80 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] z-20">
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button 
              size="lg" 
              className="w-full h-14 text-base font-extrabold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md active:scale-98"
              disabled={items.length === 0}
            >
              Avançar para Pagamento • {cartTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </Button>
          </SheetTrigger>
          
          <SheetContent side="bottom" className="h-[75dvh] bg-slate-50 rounded-t-[2rem] p-0 border-t-0 shadow-2xl flex flex-col overflow-hidden">
            <SheetHeader className="text-left p-5 bg-white border-b border-slate-100 shrink-0">
              <SheetTitle className="text-xl font-black text-slate-900">Pagamento</SheetTitle>
              <p className="text-slate-400 font-bold text-sm">
                Total a receber: <span className="text-blue-600">{cartTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </p>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="space-y-2 pt-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Forma de Recebimento</span>
                <div className="grid grid-cols-2 gap-3">
                  {(["pix", "credit_card", "debit_card", "cash"] as const).map((method) => (
                    <button
                      key={method} type="button" onClick={() => setPaymentMethod(method)}
                      className={`flex flex-col items-center justify-center p-4 border-2 rounded-2xl transition-all ${paymentMethod === method ? "border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-600/5" : "border-slate-200 bg-white text-slate-600"}`}
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
                className="w-full h-14 text-base font-bold bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-lg"
                onClick={handleCheckout}
                disabled={isCheckingOut}
              >
                {isCheckingOut ? <Loader2 className="h-5 w-5 animate-spin" /> : `Confirmar Recebimento`}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}