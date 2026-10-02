// src/app/(dashboard)/clientes/client-manager.tsx
"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  Search, Plus, Phone, AlertTriangle, Users, 
  UserMinus, ChevronRight, Info, Activity, Clock, 
  XCircle, UserCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface EnrichedCliente {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  status: string;
  created_at: string;
  crmStatus: "ATIVO" | "EM_RISCO" | "INATIVO" | "NOVO";
  ultimaVisita: string | null;
}

interface GlobalKpis {
  ativos: number;
  emRisco: number;
  inativos: number;
  novos: number;
  ticketMedio: number;
  conversao: number;
  noShows: number;
  cancelamentos: number;
  servicoTop: string;
  taxaRetencao: number;
  frequenciaGlobal: number;
}

interface ClientManagerProps {
  initialClientes: EnrichedCliente[];
  globalKpis: GlobalKpis;
}

export default function ClientManager({ initialClientes, globalKpis }: ClientManagerProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<"TODOS" | "ATIVO" | "EM_RISCO" | "INATIVO" | "NOVO">("TODOS");

  const filteredClientes = useMemo(() => {
    return initialClientes.filter((c) => {
      const matchSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (c.phone && c.phone.includes(searchTerm));
      const matchFilter = activeFilter === "TODOS" || c.crmStatus === activeFilter;
      return matchSearch && matchFilter;
    });
  }, [initialClientes, searchTerm, activeFilter]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const getInitials = (name: string) => {
    const p = name.trim().split(" ");
    return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : name.substring(0, 2).toUpperCase();
  };

  const getCrmStatusBadge = (status: string) => {
    switch (status) {
      case "ATIVO": return <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 shadow-sm gap-1.5"><div className="size-1.5 rounded-full bg-emerald-500"/> Ativo</Badge>;
      case "EM_RISCO": return <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200 shadow-sm gap-1.5"><div className="size-1.5 rounded-full bg-amber-500 animate-pulse"/> Em Risco</Badge>;
      case "INATIVO": return <Badge className="bg-red-50 text-red-700 hover:bg-red-100 border-red-200 shadow-sm gap-1.5"><div className="size-1.5 rounded-full bg-red-500"/> Inativo</Badge>;
      case "NOVO": return <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200 shadow-sm gap-1.5"><div className="size-1.5 rounded-full bg-blue-500"/> Novo</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      
      {/* ========================================================= */}
      {/* TÍTULO E MODAL DE EXPLICAÇÃO DA INTELIGÊNCIA */}
      {/* ========================================================= */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Centro Nervoso (CRM)</h1>
          
          <Dialog>
            <DialogTrigger asChild>
              <button className="p-1.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition-colors mt-1">
                <Info className="size-5" />
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto rounded-[2rem] p-6 sm:p-8">
              <DialogHeader className="mb-6">
                <DialogTitle className="text-2xl font-black text-slate-900">Como funciona o Centro Nervoso?</DialogTitle>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                  O BarberFlow não apenas guarda nomes, ele usa inteligência artificial e matemática comportamental para te dizer exatamente como está a saúde da sua barbearia. Entenda as métricas:
                </p>
              </DialogHeader>

              <div className="space-y-8">
                {/* Status: Novo */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-blue-50 text-blue-700 border-blue-200 shadow-sm">NOVO</Badge>
                    <h3 className="font-bold text-slate-900">Zero agendamentos concluídos</h3>
                  </div>
                  <div className="text-sm text-slate-600 space-y-2 leading-relaxed">
                    <p><strong>Como funciona:</strong> O cliente se cadastrou ou você adicionou manualmente, mas ele ainda não finalizou nenhum atendimento no PDV.</p>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <strong>Exemplo Prático:</strong> O João criou a conta hoje e agendou para semana que vem. O sistema sabe que ele existe, mas ele continuará como &quot;NOVO&quot; até o barbeiro apertar &quot;Finalizar&quot; no atendimento dele pela primeira vez.
                    </div>
                  </div>
                </div>

                {/* Status: Ativo */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm">ATIVO</Badge>
                    <h3 className="font-bold text-slate-900">O status mais inteligente do sistema</h3>
                  </div>
                  <div className="text-sm text-slate-600 space-y-2 leading-relaxed">
                    <p>Este status se adapta à rotina de cada cliente individualmente. Para ser &quot;ATIVO&quot;, o cliente precisa estar dentro da janela ideal de retorno. O sistema verifica:</p>
                    <ul className="list-disc list-inside pl-4 space-y-1">
                      <li>Ele já tem algum atendimento finalizado? <strong>(Sim)</strong></li>
                      <li>Faz menos de 90 dias desde a última visita? <strong>(Sim)</strong></li>
                      <li>Ele está atrasado além da conta? <strong>(Não)</strong></li>
                    </ul>
                    <p className="pt-2"><strong>A Mágica da Frequência:</strong> O sistema calcula o tempo médio que <em>aquele cliente específico</em> leva para voltar. Depois, ele dá uma tolerância extra de 7 dias.</p>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <strong>Exemplo Prático:</strong> O Carlos costuma cortar a cada 20 dias. Hoje faz 23 dias. Ele continua ATIVO, pois o sistema dá a ele até 27 dias (20 de média + 7 de tolerância). Se chegar o 28º dia e ele não aparecer, o sistema o joga automaticamente para 🟠 EM RISCO.
                    </div>
                  </div>
                </div>

                {/* Resumo do Ciclo de Vida */}
                <div>
                  <h3 className="font-bold text-slate-900 mb-3 border-b border-slate-100 pb-2">Resumo do Ciclo de Vida</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100"><strong>Novo:</strong> Cadastrou, mas não consumiu.</div>
                    <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100"><strong>Ativo:</strong> Volta sempre no tempo certo.</div>
                    <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100"><strong>Em Risco:</strong> Passou da média + 7 dias. Haja!</div>
                    <div className="p-3 bg-red-50/50 rounded-xl border border-red-100"><strong>Inativo:</strong> Sumiu há mais de 90 dias.</div>
                  </div>
                </div>

                {/* Eficiência Operacional */}
                <div>
                  <h3 className="font-bold text-slate-900 mb-3 border-b border-slate-100 pb-2">Eficiência Operacional & Financeiro</h3>
                  <div className="space-y-4 text-sm text-slate-600">
                    <div>
                      <strong className="text-purple-700">Ticket Médio Geral:</strong> 
                      <p className="mt-1">Soma de todo o faturamento da barbearia dividida pelo total de agendamentos finalizados.</p>
                    </div>
                    <div>
                      <strong className="text-blue-700">Taxa de Retenção Global:</strong> 
                      <p className="mt-1">Porcentagem de clientes saudáveis. Calculada pela soma de (Ativos + Em Risco) dividida por todos os clientes que já pisaram na barbearia alguma vez (ignorando os Novos).</p>
                    </div>
                    <div>
                      <strong className="text-emerald-700">Taxa de Conversão:</strong> 
                      <p className="mt-1">Qual a chance de um agendamento na sua agenda realmente se tornar dinheiro? (Atendimentos Concluídos ÷ Total de Agendamentos Criados).</p>
                    </div>
                    <div>
                      <strong className="text-amber-700">No-shows (Faltas):</strong> 
                      <p className="mt-1">Agendamentos onde o cliente simplesmente não apareceu e não avisou.</p>
                    </div>
                  </div>
                </div>
              </div>

            </DialogContent>
          </Dialog>

        </div>
        <p className="text-sm font-medium text-slate-500 mt-1">
          Inteligência, retenção e visão geral da saúde da sua base de clientes.
        </p>
      </div>

      {/* ========================================================= */}
      {/* 📊 CENTRO NERVOSO (DASHBOARD MACRO) */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Ativos & Retenção (INTERATIVO) */}
        <div 
          onClick={() => setActiveFilter(activeFilter === "ATIVO" ? "TODOS" : "ATIVO")}
          className={cn(
            "bg-white rounded-[2rem] p-6 border transition-all cursor-pointer hover:shadow-md",
            activeFilter === "ATIVO" ? "border-emerald-500 ring-4 ring-emerald-500/10 shadow-md" : "border-slate-100 shadow-sm"
          )}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600"><Users className="size-5" /></div>
            {activeFilter === "ATIVO" && <Badge className="bg-emerald-500 text-white">Filtrado</Badge>}
          </div>
          <h3 className="text-3xl font-black text-slate-900">{globalKpis.ativos}</h3>
          <p className="text-sm font-medium text-slate-500 mt-1">Clientes Ativos</p>
        </div>

        {/* Card 2: Em Risco (INTERATIVO - Alerta) */}
        <div 
          onClick={() => setActiveFilter(activeFilter === "EM_RISCO" ? "TODOS" : "EM_RISCO")}
          className={cn(
            "bg-white rounded-[2rem] p-6 border transition-all cursor-pointer hover:shadow-md",
            activeFilter === "EM_RISCO" ? "border-amber-500 ring-4 ring-amber-500/10 shadow-md" : "border-slate-100 shadow-sm"
          )}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-amber-50 rounded-2xl text-amber-600"><AlertTriangle className="size-5" /></div>
            {activeFilter === "EM_RISCO" && <Badge className="bg-amber-500 text-white">Filtrado</Badge>}
          </div>
          <h3 className="text-3xl font-black text-slate-900">{globalKpis.emRisco}</h3>
          <p className="text-sm font-medium text-slate-500 mt-1">Atrasados (Em Risco)</p>
        </div>

        {/* Card 3: Inativos (INTERATIVO) */}
        <div 
          onClick={() => setActiveFilter(activeFilter === "INATIVO" ? "TODOS" : "INATIVO")}
          className={cn(
            "bg-white rounded-[2rem] p-6 border transition-all cursor-pointer hover:shadow-md",
            activeFilter === "INATIVO" ? "border-red-500 ring-4 ring-red-500/10 shadow-md" : "border-slate-100 shadow-sm"
          )}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-red-50 rounded-2xl text-red-600"><UserMinus className="size-5" /></div>
            {activeFilter === "INATIVO" && <Badge className="bg-red-500 text-white">Filtrado</Badge>}
          </div>
          <h3 className="text-3xl font-black text-slate-900">{globalKpis.inativos}</h3>
          <p className="text-sm font-medium text-slate-500 mt-1">Perdidos ({">"}90 dias)</p>
        </div>

        {/* Card 4: Financeiro Principal */}
        <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-lg flex flex-col justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">Ticket Médio Geral</p>
            <h3 className="text-3xl font-black text-emerald-400">{formatCurrency(globalKpis.ticketMedio)}</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-slate-800">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500">Conversão</p>
              <p className="text-lg font-bold text-white">{globalKpis.conversao}%</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500">Serviço Top</p>
              <p className="text-sm font-bold text-white truncate mt-1" title={globalKpis.servicoTop}>{globalKpis.servicoTop}</p>
            </div>
          </div>
        </div>

      </div>

      {/* ========================================================= */}
      {/* ⚙️ PAINEL DE EFICIÊNCIA OPERACIONAL (NOVO) */}
      {/* ========================================================= */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50/50 rounded-3xl p-4 sm:p-6 border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-100 text-blue-600 rounded-xl"><UserCheck className="size-4" /></div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400">Retenção Global</p>
            <p className="text-lg font-black text-slate-900 leading-tight">{globalKpis.taxaRetencao}%</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-100 text-purple-600 rounded-xl"><Clock className="size-4" /></div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400">Frequência Média</p>
            <p className="text-lg font-black text-slate-900 leading-tight">{globalKpis.frequenciaGlobal > 0 ? `${globalKpis.frequenciaGlobal} dias` : '-'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-100 text-red-600 rounded-xl"><XCircle className="size-4" /></div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400">No-shows</p>
            <p className="text-lg font-black text-slate-900 leading-tight">{globalKpis.noShows}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-100 text-amber-600 rounded-xl"><AlertTriangle className="size-4" /></div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400">Cancelamentos</p>
            <p className="text-lg font-black text-slate-900 leading-tight">{globalKpis.cancelamentos}</p>
          </div>
        </div>
      </div>

      {/* Alerta Estratégico */}
      {globalKpis.emRisco > 0 && activeFilter === "TODOS" && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between animate-in slide-in-from-bottom-2">
          <div className="flex items-center gap-3 text-amber-800">
            <AlertTriangle className="size-5" />
            <p className="text-sm font-bold">
              Você tem {globalKpis.emRisco} cliente(s) que já deveriam ter voltado. 
              <span className="font-medium ml-1">Foque neles para garantir sua receita da semana!</span>
            </p>
          </div>
          <Button onClick={() => setActiveFilter("EM_RISCO")} size="sm" className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold">
            Ver Clientes
          </Button>
        </div>
      )}

      {/* ========================================================= */}
      {/* 🔍 BARRA DE BUSCA E LISTAGEM */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative w-full sm:max-w-md flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input 
            placeholder="Buscar por nome ou telefone..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-11 border-0 bg-transparent shadow-none focus-visible:ring-0 h-12 text-base font-medium"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto px-2 pb-2 sm:p-0">
          {activeFilter !== "TODOS" && (
            <Button onClick={() => setActiveFilter("TODOS")} variant="ghost" className="text-slate-500 hover:text-slate-900 rounded-xl">
              Limpar Filtro
            </Button>
          )}
          <Button className="w-full sm:w-auto rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 px-6 shadow-md shadow-blue-500/20">
            <Plus className="size-5 mr-2" /> Novo Cliente
          </Button>
        </div>
      </div>

      {/* Lista de Resultados Híbrida */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        
        {/* Mobile View */}
        <div className="block md:hidden divide-y divide-slate-100">
          {filteredClientes.length === 0 ? (
            <div className="p-8 text-center text-slate-500 font-medium">Nenhum cliente encontrado.</div>
          ) : (
            filteredClientes.map((cliente) => (
              <div key={cliente.id} onClick={() => router.push(`/clientes/${cliente.id}`)} className="flex items-center p-5 active:bg-slate-50 transition-colors cursor-pointer group">
                <div className="size-12 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-black text-sm shrink-0 group-active:scale-95 transition-transform">
                  {getInitials(cliente.name)}
                </div>
                <div className="ml-4 flex-1 min-w-0">
                  <h3 className="text-base font-bold text-slate-900 truncate">{cliente.name}</h3>
                  <p className="text-xs font-medium text-slate-500 truncate mt-0.5">
                    Última visita: {cliente.ultimaVisita ? new Date(cliente.ultimaVisita).toLocaleDateString('pt-BR') : 'Nunca'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 ml-4 shrink-0">
                  {getCrmStatusBadge(cliente.crmStatus)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">Contato</th>
                <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">Status CRM</th>
                <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClientes.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-500 font-medium">Nenhum cliente encontrado.</td></tr>
              ) : (
                filteredClientes.map((cliente) => (
                  <tr key={cliente.id} onClick={() => router.push(`/clientes/${cliente.id}`)} className="hover:bg-slate-50/50 transition-colors group cursor-pointer">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="size-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-black text-sm group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          {getInitials(cliente.name)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{cliente.name}</p>
                          <p className="text-xs font-medium text-slate-500 mt-0.5">
                            Última visita: {cliente.ultimaVisita ? new Date(cliente.ultimaVisita).toLocaleDateString('pt-BR') : 'Nunca'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <Phone className="size-3.5 text-slate-400" /> {cliente.phone ? cliente.phone : 'Sem número'}
                      </p>
                    </td>
                    <td className="px-6 py-5">
                      {getCrmStatusBadge(cliente.crmStatus)}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <Button variant="ghost" size="icon" className="text-slate-400 group-hover:text-blue-600 rounded-xl">
                        <ChevronRight className="size-5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}