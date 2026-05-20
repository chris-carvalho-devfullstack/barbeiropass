"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
// Importação corrigida para o arquivo de ações da fila
import { joinQueueAction } from "@/app/(dashboard)/fila/actions"; 
import { searchClientForPDV } from "@/app/(dashboard)/pdv/actions";
import { toast } from "sonner";
import { Sparkles, UserCheck, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// =========================================================================
// TIPAGENS (LIVRE DE 'ANY')
// =========================================================================
interface Barbershop {
  id: string;
  name: string;
  logo_url: string | null;
}

interface ClientSuggestion {
  id: string;
  name: string;
  phone?: string | null;
  document?: string | null;
}

export const runtime = 'edge';

export default function PublicQueuePage() {
  const params = useParams() as { slug: string };
  
  // Estados Tipados
  const [barbershop, setBarbershop] = useState<Barbershop | null>(null);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<ClientSuggestion[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientSuggestion | null>(null);
  const [loading, setLoading] = useState(false);

  // Memoizando o cliente para evitar avisos de dependência do useEffect
  const supabase = useMemo(() => createClient(), []);

  // Busca dados da barbearia pelo Slug
  useEffect(() => {
    async function loadBarbershop() {
      if (!params.slug) return;
      
      const { data, error } = await supabase
        .from("barbershops")
        .select("id, name, logo_url")
        .eq("slug", params.slug)
        .single();

      if (!error && data) {
        setBarbershop(data as Barbershop);
      }
    }
    loadBarbershop();
  }, [params.slug, supabase]);

  // Autocomplete de clientes cadastrados
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (search.length >= 3) {
        const res = await searchClientForPDV(search);
        setSuggestions((res.results || []) as ClientSuggestion[]);
      } else {
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [search]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!barbershop) return;
    if (!name && !selectedClient) {
      toast.error("Por favor, identifique-se para entrar na fila.");
      return;
    }

    setLoading(true);
    
    try {
      const res = await joinQueueAction({
        barbershop_id: barbershop.id,
        client_name: selectedClient ? selectedClient.name : name,
        client_id: selectedClient?.id || null
      });

      if (res.success) {
        toast.success("Você está na fila!");
        // Pequeno delay antes de recarregar para o usuário ver o feedback
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast.error(res.error || "Ocorreu um erro ao entrar na fila.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  if (!barbershop) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-2">
        <Loader2 className="animate-spin text-blue-600 size-10" />
        <p className="text-slate-500 font-medium">Buscando barbearia...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center">
      <div className="w-full max-w-md space-y-8 mt-10 text-center">
        {barbershop.logo_url && (
          <img 
            src={barbershop.logo_url} 
            className="w-24 h-24 rounded-3xl mx-auto shadow-lg border-4 border-white object-cover" 
            alt="Logo" 
          />
        )}
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">{barbershop.name}</h1>
        <p className="text-slate-500 font-medium italic">
          &quot;O próximo na cadeira pode ser você!&quot;
        </p>

        <div className="bg-white p-6 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 space-y-6">
          {selectedClient ? (
            <div className="bg-blue-50 p-4 rounded-2xl flex items-center justify-between border border-blue-100 animate-in fade-in slide-in-from-top-2">
               <div className="flex items-center gap-3">
                 <div className="bg-blue-600 p-2 rounded-lg text-white shadow-md">
                   <UserCheck size={20} />
                 </div>
                 <div className="text-left">
                    <p className="text-[10px] font-black text-blue-600 uppercase">Confirmado como</p>
                    <p className="font-bold text-blue-900 leading-tight">{selectedClient.name}</p>
                 </div>
               </div>
               <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedClient(null)}
                className="text-blue-700 hover:bg-blue-100 font-bold"
               >
                 Trocar
               </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2 text-left px-1">
                  Já é cliente?
                </span>
                <Input 
                  placeholder="Seu nome ou CPF..." 
                  value={search} 
                  onChange={e => setSearch(e.target.value)} 
                  className="h-14 rounded-2xl bg-slate-50 border-slate-100 focus:ring-blue-600/20" 
                />
                
                {suggestions.length > 0 && (
                  <div className="absolute top-[110%] left-0 right-0 bg-white border border-slate-100 shadow-2xl rounded-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95">
                    {suggestions.map(s => (
                      <button 
                        key={s.id} 
                        onClick={() => { setSelectedClient(s); setSuggestions([]); }} 
                        className="w-full p-4 text-left border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors"
                      >
                        <p className="font-bold text-slate-800">{s.name}</p>
                        {s.phone && <p className="text-xs text-slate-400 font-mono">{s.phone}</p>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4 py-2">
                <div className="h-px bg-slate-100 flex-1" />
                <span className="text-[10px] font-black text-slate-300 uppercase">ou</span>
                <div className="h-px bg-slate-100 flex-1" />
              </div>

              <div className="text-left">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2 text-left px-1">
                  Entrar como avulso
                </span>
                <Input 
                  placeholder="Digite seu nome completo" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  className="h-14 rounded-2xl bg-slate-50 border-slate-100 focus:ring-blue-600/20" 
                />
              </div>
            </div>
          )}

          <Button 
            onClick={handleJoin}
            disabled={loading || (!name && !selectedClient)}
            className="w-full h-16 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-lg shadow-lg shadow-blue-200 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="animate-spin size-6" />
            ) : (
              <div className="flex items-center gap-2">
                <Sparkles className="size-5" />
                <span>Entrar na Fila Virtual</span>
              </div>
            )}
          </Button>
          
          <p className="text-[10px] text-slate-400 font-medium">
            Ao entrar, você concorda em aguardar ser chamado pelo painel.
          </p>
        </div>
      </div>
    </div>
  );
}