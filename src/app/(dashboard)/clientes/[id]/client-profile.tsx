// src/app/(dashboard)/clientes/[id]/client-profile.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, Phone, Calendar, TrendingUp, AlertTriangle, 
  CheckCircle2, Clock, CreditCard, User as UserIcon,
  MessageCircle, Star, XCircle, Mail, Info, Scissors, ShoppingBag, Sliders
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface EventPayload {
  appointment_id?: string;
  scheduled_at?: string;
  barber_id?: string;
  service_ids?: string[];
  [key: string]: unknown;
}

interface EventLog {
  id: string;
  created_at: string;
  event_type: string;
  payload: EventPayload;
  performed_by: string | null;
}

interface AgendamentoItem {
  id: string;
  scheduled_at: string;
  status: string;
  barberName: string;
  services: string[];
}

interface ComprasItem {
  id: string;
  total: number;
  date: string;
  method: string;
  items: { name: string; quantity: number }[];
}

interface CustomerProfileData {
  dadosPessoais: {
    id: string;
    nome: string;
    telefone: string | null;
    email: string | null;
    membroDesde: string;
    statusConta: string;
  };
  kpis: {
    ltv: number;
    ticketMedio: number;
    totalVisitas: number;
    frequenciaDias: number;
    ultimaVisita: string | null;
    proximaVisita: string | null;
    healthScore: number;
    crmStatus: string;
    noShows: number;
    cancelamentos: number;
    profissionalFavorito: string;
    servicoFavorito: string; // <- Nova Tipagem
  };
  agendamentos: AgendamentoItem[];
  comprasPDV: ComprasItem[];
  timeline: EventLog[];
}

export default function ClientProfile({ initialData }: { initialData: CustomerProfileData }) {
  const router = useRouter();
  const { dadosPessoais, kpis, agendamentos, comprasPDV, timeline } = initialData;
  
  const [activeTab, setActiveTab] = useState<"timeline" | "agenda" | "compras" | "preferencias">("timeline");

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatDate = (isoDate: string | null, short = false) => {
    if (!isoDate) return "-";
    const date = new Date(isoDate);
    if (short) {
      return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date);
    }
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return "Sem número";
    const p = phone.replace(/\D/g, "");
    if (p.length === 11) return p.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    if (p.length === 10) return p.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    return phone;
  };

  const getScoreTheme = (score: number) => {
    if (score >= 80) return { color: "text-emerald-500", bg: "bg-emerald-50", bar: "bg-emerald-500", label: "Cliente VIP", icon: Star };
    if (score >= 50) return { color: "text-blue-500", bg: "bg-blue-50", bar: "bg-blue-500", label: "Regular", icon: CheckCircle2 };
    if (score >= 30) return { color: "text-amber-500", bg: "bg-amber-50", bar: "bg-amber-500", label: "Em Risco", icon: AlertTriangle };
    return { color: "text-red-500", bg: "bg-red-50", bar: "bg-red-500", label: "Perdido", icon: XCircle };
  };

  const theme = getScoreTheme(kpis.healthScore);
  const StatusIcon = theme.icon;

  const getEventVisuals = (eventType: string) => {
    switch (eventType.toUpperCase()) {
      case 'APPOINTMENT_CREATED':
        return { icon: Calendar, color: "text-blue-600", bg: "bg-blue-100", label: "Agendamento Realizado" };
      case 'CUSTOMER_CREATED':
        return { icon: UserIcon, color: "text-emerald-600", bg: "bg-emerald-100", label: "Cadastro Criado" };
      case 'POS_ORDER_COMPLETED':
        return { icon: CreditCard, color: "text-purple-600", bg: "bg-purple-100", label: "Pagamento Aprovado" };
      default:
        return { icon: CheckCircle2, color: "text-slate-600", bg: "bg-slate-100", label: "Atividade Registrada" };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'finished':
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Concluído</Badge>;
      case 'scheduled':
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200">Agendado</Badge>;
      case 'no_show':
        return <Badge className="bg-red-50 text-red-700 border-red-200">Faltou (No-Show)</Badge>;
      case 'canceled':
      case 'cancelled':
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="flex items-center gap-4 sm:gap-6">
          <button 
            onClick={() => router.back()} 
            className="p-3 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
          >
            <ArrowLeft className="size-5 sm:size-6" />
          </button>
          
          <div className="flex items-center gap-4">
            <div className="size-14 sm:size-16 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xl tracking-tight shadow-md">
              {getInitials(dadosPessoais.nome)}
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none">
                {dadosPessoais.nome}
              </h1>
              <p className="text-sm font-medium text-slate-500 flex items-center gap-2 mt-1.5">
                <Calendar className="size-3.5" />
                Membro desde {formatDate(dadosPessoais.membroDesde, true)}
              </p>
            </div>
          </div>
        </div>

        {dadosPessoais.telefone && (
          <a 
            href={`https://wa.me/55${dadosPessoais.telefone.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            <MessageCircle className="size-5" />
            <span>WhatsApp</span>
          </a>
        )}
      </div>

      {/* BENTO GRID DE MÉTRICAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="col-span-1 md:col-span-2 lg:col-span-2 bg-white rounded-[2rem] p-6 sm:p-8 border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Health Score</p>
                <Popover>
                  <PopoverTrigger asChild><button className="text-slate-300 hover:text-blue-500"><Info className="size-3.5" /></button></PopoverTrigger>
                  <PopoverContent className="w-64 text-sm font-medium bg-slate-900 text-white border-none rounded-xl p-4">Métrica de 0 a 100 que avalia a fidelidade e saúde do cliente.</PopoverContent>
                </Popover>
              </div>
              <h3 className="text-3xl font-black text-slate-900 tracking-tighter">
                {kpis.healthScore} <span className="text-lg text-slate-400 font-bold">/100</span>
              </h3>
            </div>
            <div className={cn("px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-sm", theme.bg, theme.color)}>
              <StatusIcon className="size-4" />
              {theme.label}
            </div>
          </div>
          <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full transition-all duration-1000", theme.bar)} style={{ width: `${kpis.healthScore}%` }} />
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 sm:p-8 border border-slate-100 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-4 text-emerald-600">
            <div className="p-2 bg-emerald-50 rounded-xl"><TrendingUp className="size-4" /></div>
            <span className="text-[11px] font-black uppercase tracking-widest">LTV</span>
            <Popover>
              <PopoverTrigger asChild><button className="text-emerald-300 hover:text-emerald-600"><Info className="size-3.5" /></button></PopoverTrigger>
              <PopoverContent className="w-64 text-sm bg-slate-900 text-white border-none rounded-xl p-4">Valor total gerado pelo cliente em toda a história na barbearia.</PopoverContent>
            </Popover>
          </div>
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{formatCurrency(kpis.ltv)}</h3>
        </div>

        <div className="bg-white rounded-[2rem] p-6 sm:p-8 border border-slate-100 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-4 text-purple-600">
            <div className="p-2 bg-purple-50 rounded-xl"><CreditCard className="size-4" /></div>
            <span className="text-[11px] font-black uppercase tracking-widest">Ticket Médio</span>
            <Popover>
              <PopoverTrigger asChild><button className="text-purple-300 hover:text-purple-600"><Info className="size-3.5" /></button></PopoverTrigger>
              <PopoverContent className="w-64 text-sm bg-slate-900 text-white border-none rounded-xl p-4">Média de gasto do cliente por visita concluída.</PopoverContent>
            </Popover>
          </div>
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{formatCurrency(kpis.ticketMedio)}</h3>
        </div>
      </div>

      {/* GRID SECUNDÁRIO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="col-span-1 lg:col-span-2 bg-white rounded-[2rem] p-6 sm:p-8 border border-slate-100 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-6 divide-x divide-slate-100">
          <div className="pl-0 flex flex-col justify-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Visitas</p>
            <p className="text-2xl font-black text-slate-900">{kpis.totalVisitas}</p>
          </div>
          
          <div className="pl-6 flex flex-col justify-center relative">
            <div className="flex items-center gap-1.5 mb-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Frequência</p>
              <Popover>
                <PopoverTrigger asChild><button><Info className="size-3 text-slate-300 hover:text-blue-500" /></button></PopoverTrigger>
                <PopoverContent className="w-64 text-sm bg-slate-900 text-white border-none rounded-xl p-4">A média exata de dias que ele leva para cortar o cabelo novamente.</PopoverContent>
              </Popover>
            </div>
            <p className="text-2xl font-black text-slate-900">{kpis.frequenciaDias > 0 ? `${kpis.frequenciaDias}d` : '-'}</p>
          </div>
          
          <div className="pl-6 flex flex-col justify-center relative">
            <div className="flex items-center gap-1.5 mb-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Próxima Prev.</p>
              <Popover>
                <PopoverTrigger asChild><button><Info className="size-3 text-slate-300 hover:text-blue-500" /></button></PopoverTrigger>
                <PopoverContent className="w-64 text-sm bg-slate-900 text-white border-none rounded-xl p-4">Calculada somando a média de Frequência com a data do último atendimento.</PopoverContent>
              </Popover>
            </div>
            <p className={cn("text-lg font-black truncate", !kpis.proximaVisita ? "text-slate-400" : new Date(kpis.proximaVisita) < new Date() ? "text-red-500" : "text-slate-900")}>
              {formatDate(kpis.proximaVisita, true)}
            </p>
          </div>
          
          {/* NOVA COLUNA: FAVORITOS AGRUPADOS */}
          <div className="pl-6 flex flex-col justify-center relative">
            <div className="flex items-center gap-1.5 mb-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Favoritos</p>
              <Popover>
                <PopoverTrigger asChild><button><Info className="size-3 text-slate-300 hover:text-blue-500" /></button></PopoverTrigger>
                <PopoverContent className="w-64 text-sm bg-slate-900 text-white border-none rounded-xl p-4">Profissional e serviço mais consumidos historicamente por este cliente.</PopoverContent>
              </Popover>
            </div>
            <p className="text-sm font-bold text-slate-900 leading-tight truncate" title={kpis.profissionalFavorito}>
              {kpis.profissionalFavorito}
            </p>
            <p className="text-[11px] font-medium text-slate-500 truncate mt-0.5 flex items-center gap-1" title={kpis.servicoFavorito}>
              <Scissors className="size-3 text-slate-400" /> 
              {kpis.servicoFavorito}
            </p>
          </div>

        </div>

        <div className="bg-slate-900 rounded-[2rem] p-6 sm:p-8 text-white flex flex-col justify-between shadow-lg">
          <div className="space-y-4">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-4">Contato Oficial</p>
            <div className="flex items-center gap-3">
              <Phone className="size-4 text-slate-400" />
              <p className="font-medium">{formatPhone(dadosPessoais.telefone)}</p>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="size-4 text-slate-400" />
              <p className="font-medium truncate">{dadosPessoais.email || "Sem e-mail"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* 📑 SISTEMA DE ABAS CONTEXTUAIS */}
      {/* ======================================================================= */}
      <div className="mt-8 space-y-6">
        
        <div className="flex items-center gap-2 border-b border-slate-200 pb-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab("timeline")}
            className={cn("px-5 py-2.5 rounded-2xl font-bold text-sm transition-all whitespace-nowrap active:scale-95", activeTab === "timeline" ? "bg-slate-900 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50")}
          >
            Linha do Tempo
          </button>
          <button
            onClick={() => setActiveTab("agenda")}
            className={cn("px-5 py-2.5 rounded-2xl font-bold text-sm transition-all whitespace-nowrap active:scale-95", activeTab === "agenda" ? "bg-slate-900 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50")}
          >
            Agendas & Atendimentos
          </button>
          <button
            onClick={() => setActiveTab("compras")}
            className={cn("px-5 py-2.5 rounded-2xl font-bold text-sm transition-all whitespace-nowrap active:scale-95", activeTab === "compras" ? "bg-slate-900 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50")}
          >
            Produtos & PDV
          </button>
          <button
            onClick={() => setActiveTab("preferencias")}
            className={cn("px-5 py-2.5 rounded-2xl font-bold text-sm transition-all whitespace-nowrap active:scale-95", activeTab === "preferencias" ? "bg-slate-900 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50")}
          >
            Preferências do Cliente
          </button>
        </div>

        {/* ABA 1: LINHA DO TEMPO */}
        {activeTab === "timeline" && (
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-4 sm:p-8 animate-in fade-in">
            {timeline.length === 0 ? (
              <p className="text-center py-8 text-slate-400 font-medium">Nenhum evento registrado.</p>
            ) : (
              <div className="relative pl-4 sm:pl-6 border-l-2 border-slate-100 space-y-8 py-2">
                {timeline.map((event, index) => {
                  const visuals = getEventVisuals(event.event_type);
                  const Icon = visuals.icon;
                  return (
                    <div key={event.id} className="relative">
                      <div className={cn("absolute -left-6 sm:-left-9 size-10 rounded-full flex items-center justify-center border-4 border-white shadow-sm z-10", visuals.bg, visuals.color)}>
                        <Icon className="size-4" />
                      </div>
                      <div className="pl-6 sm:pl-8 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-slate-900">{visuals.label}</p>
                          <p className="text-xs text-slate-400">Registrado em {formatDate(event.created_at)}</p>
                        </div>
                        {index === 0 && <Badge variant="secondary">Recente</Badge>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ABA 2: AGENDA */}
        {activeTab === "agenda" && (
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-4 sm:p-8 animate-in fade-in space-y-4">
            {agendamentos.length === 0 ? (
              <p className="text-center py-8 text-slate-400 font-medium">Nenhum agendamento encontrado.</p>
            ) : (
              agendamentos.map((item) => (
                <div key={item.id} className="p-4 sm:p-5 rounded-2xl border border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Calendar className="size-4 text-blue-600" />
                      <span className="font-bold text-slate-900 text-sm">{formatDate(item.scheduled_at)}</span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      Profissional: <strong className="text-slate-700">{item.barberName}</strong>
                    </p>
                    {item.services.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {item.services.map((srv, idx) => (
                          <span key={idx} className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md border border-blue-100">
                            {srv}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    {getStatusBadge(item.status)}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ABA 3: PRODUTOS & PDV */}
        {activeTab === "compras" && (
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-4 sm:p-8 animate-in fade-in space-y-4">
            {comprasPDV.length === 0 ? (
              <p className="text-center py-8 text-slate-400 font-medium">Nenhuma compra registrada no PDV.</p>
            ) : (
              comprasPDV.map((compra) => (
                <div key={compra.id} className="p-4 sm:p-6 rounded-2xl border border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-3 w-full">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <ShoppingBag className="size-4 text-purple-600" />
                          <span className="font-bold text-slate-900 text-lg">{formatCurrency(compra.total)}</span>
                        </div>
                        <p className="text-xs font-medium text-slate-400 mt-0.5">Realizado em {formatDate(compra.date)}</p>
                      </div>
                      <Badge variant="outline" className="bg-white text-purple-700 border-purple-200 shadow-sm">
                        {compra.method}
                      </Badge>
                    </div>

                    {compra.items.length > 0 && (
                      <div className="pt-3 border-t border-slate-200/60">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Itens da Venda</p>
                        <div className="space-y-1.5">
                          {compra.items.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm">
                              <span className="flex items-center justify-center bg-slate-200 text-slate-600 font-bold text-[10px] rounded px-1.5 py-0.5 min-w-[20px]">
                                {item.quantity}x
                              </span>
                              <span className="font-medium text-slate-700">{item.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ABA 4: PREFERÊNCIAS */}
        {activeTab === "preferencias" && (
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 sm:p-8 animate-in fade-in space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl"><Sliders className="size-6" /></div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Preferências e Observações</h3>
                <p className="text-sm text-slate-500">Notas e restrições informadas pelo barbeiro.</p>
              </div>
            </div>

            <div className="p-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center space-y-3">
              <p className="text-sm font-medium text-slate-600">
                Nenhuma preferência personalizada cadastrada para este cliente ainda.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}