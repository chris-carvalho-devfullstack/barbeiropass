// src/app/(dashboard)/agendamentos/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { 
  Calendar, Loader2, CheckCircle, XCircle, Clock, 
  Scissors, Wallet, LayoutList, CalendarDays, 
  ChevronLeft, ChevronRight, CalendarRange, Calendar as CalendarIconMonth
} from "lucide-react";
import { toast } from "sonner";
import { 
  format, addDays, subDays, isSameDay, isToday, 
  startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks,
  startOfMonth, endOfMonth, addMonths, subMonths, isSameMonth
} from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreateAppointmentDialog } from "@/components/create-appointment-dialog";
import { cn } from "@/lib/utils";

type AppointmentData = {
  id: string;
  scheduled_at: string;
  status: "scheduled" | "in_progress" | "completed" | "canceled" | "awaiting_payment";
  client_name: string;
  client_phone: string | null;
  services: { name: string; price: number; duration_minutes: number; } | null;
};

type ViewMode = "day" | "week" | "month" | "list";

export default function AgendamentosPage() {
  const [agendamentos, setAgendamentos] = useState<AppointmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const fetchAgendamentos = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/agendamentos");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Erro ao buscar agendamentos.");
      setAgendamentos(result.data as AppointmentData[]);
    } catch (error: unknown) {
      if (error instanceof Error) toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgendamentos();
  }, [fetchAgendamentos]);

  async function updateStatus(id: string, novoStatus: AppointmentData["status"]) {
    const toastId = toast.loading("A atualizar estado...");
    try {
      const response = await fetch(`/api/agendamentos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: novoStatus }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Falha ao atualizar");
      toast.success("Estado atualizado com sucesso!", { id: toastId });
      fetchAgendamentos(); 
    } catch (error: unknown) {
      if (error instanceof Error) toast.error(error.message, { id: toastId });
    }
  }

  // --- Lógica de Navegação Baseada na Visão ---
  const handlePrev = () => {
    if (viewMode === "day") setSelectedDate(subDays(selectedDate, 1));
    if (viewMode === "week") setSelectedDate(subWeeks(selectedDate, 1));
    if (viewMode === "month") setSelectedDate(subMonths(selectedDate, 1));
  };
  const handleNext = () => {
    if (viewMode === "day") setSelectedDate(addDays(selectedDate, 1));
    if (viewMode === "week") setSelectedDate(addWeeks(selectedDate, 1));
    if (viewMode === "month") setSelectedDate(addMonths(selectedDate, 1));
  };
  const handleToday = () => setSelectedDate(new Date());

  const formatarDataHora = (isoString: string) => {
    const data = new Date(isoString);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo"
    }).format(data);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled": return <Badge className="bg-blue-50 text-blue-700 border-blue-200"><Clock className="h-3 w-3 mr-1"/> Agendado</Badge>;
      case "in_progress": return <Badge className="bg-purple-50 text-purple-700 border-purple-200"><Scissors className="h-3 w-3 mr-1"/> Na Cadeira</Badge>;
      case "completed": return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200"><CheckCircle className="h-3 w-3 mr-1"/> Concluído</Badge>;
      case "canceled": return <Badge className="bg-slate-100 text-slate-600 border-slate-200"><XCircle className="h-3 w-3 mr-1"/> Cancelado</Badge>;
      case "awaiting_payment": return <Badge className="bg-amber-50 text-amber-700 border-amber-200"><Wallet className="h-3 w-3 mr-1"/> Aguardando Pag.</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const horasComerciais = Array.from({ length: 13 }, (_, i) => i + 8);

  // --- RENDERIZADORES DE VISÃO ---

  const renderControlesDeNavegacao = () => {
    let titulo = "";
    if (viewMode === "day") titulo = format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR });
    else if (viewMode === "week") {
      const inicio = startOfWeek(selectedDate, { weekStartsOn: 0 });
      const fim = endOfWeek(selectedDate, { weekStartsOn: 0 });
      titulo = `${format(inicio, "d MMM", { locale: ptBR })} - ${format(fim, "d MMM, yyyy", { locale: ptBR })}`;
    }
    else if (viewMode === "month") titulo = format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR });

    return (
      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrev} className="h-9 w-9 rounded-xl border-slate-200"><ChevronLeft className="size-4" /></Button>
          <Button variant="outline" size="icon" onClick={handleNext} className="h-9 w-9 rounded-xl border-slate-200"><ChevronRight className="size-4" /></Button>
          <Button variant="outline" onClick={handleToday} className="h-9 rounded-xl border-slate-200 font-bold ml-2 hidden sm:flex">Hoje</Button>
        </div>
        <h3 className="text-lg font-black text-slate-800 capitalize">{titulo}</h3>
      </div>
    );
  };

  const renderVisaoDia = () => {
    const agendamentosDoDia = agendamentos.filter((ag) => isSameDay(new Date(ag.scheduled_at), selectedDate));
    return (
      <div className="relative min-h-[600px] overflow-y-auto p-4 sm:p-6 bg-slate-50/30">
        {horasComerciais.map((hora) => {
          const agendamentosNestaHora = agendamentosDoDia.filter(ag => new Date(ag.scheduled_at).getHours() === hora);
          return (
            <div key={hora} className="relative flex min-h-[80px] border-b border-slate-200/60 last:border-0">
              <div className="w-16 flex-shrink-0 text-right pr-4 pt-2">
                <span className="text-sm font-bold text-slate-400">{hora.toString().padStart(2, '0')}:00</span>
              </div>
              <div className="relative flex-1 bg-white/50 border-l border-slate-200/60 group hover:bg-white transition-colors">
                {agendamentosNestaHora.map((ag) => {
                  const minutos = new Date(ag.scheduled_at).getMinutes();
                  return (
                    <div key={ag.id} className="m-2 p-3 rounded-xl border border-blue-100 bg-blue-50/50 hover:bg-blue-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-100 mt-1 sm:mt-0">
                          <span className="text-sm font-black text-blue-700">{hora.toString().padStart(2, '0')}:{minutos.toString().padStart(2, '0')}</span>
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{ag.client_name}</p>
                          <div className="flex items-center gap-2 mt-1 text-sm text-slate-500 font-medium">
                            <span className="truncate max-w-[120px] sm:max-w-xs">{ag.services?.name || "Serviço Avulso"}</span>
                            <span>•</span><span>{ag.services?.duration_minutes || 30} min</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                        {getStatusBadge(ag.status)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderVisaoSemana = () => {
    const inicioSemana = startOfWeek(selectedDate, { weekStartsOn: 0 }); // Domingo
    const diasSemana = eachDayOfInterval({ start: inicioSemana, end: endOfWeek(selectedDate, { weekStartsOn: 0 }) });
    
    return (
      <div className="flex flex-col bg-white overflow-hidden">
        {/* Cabeçalho dos Dias */}
        <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50">
          <div className="col-span-1 p-2 border-r border-slate-200"></div>
          {diasSemana.map(dia => (
            <div key={dia.toISOString()} className={cn("col-span-1 p-3 text-center border-r border-slate-200 last:border-0", isToday(dia) && "bg-blue-50")}>
              {/* CORREÇÃO: Pega o formato, tira pontos e corta exatamente as 3 primeiras letras */}
              <p className="text-xs font-bold text-slate-500 uppercase">
                {format(dia, 'EEE', { locale: ptBR }).replace('.', '').substring(0, 3)}
              </p>
              <p className={cn("text-lg font-black", isToday(dia) ? "text-blue-600" : "text-slate-800")}>{format(dia, 'd')}</p>
            </div>
          ))}
        </div>
        
        {/* Grelha de Horas */}
        <div className="overflow-y-auto max-h-[600px] overflow-x-auto">
          <div className="min-w-[800px]"> {/* Força scroll no mobile */}
            {horasComerciais.map((hora) => (
              <div key={hora} className="grid grid-cols-8 border-b border-slate-100 min-h-[80px]">
                <div className="col-span-1 border-r border-slate-200 p-2 text-right">
                  <span className="text-xs font-bold text-slate-400">{hora.toString().padStart(2, '0')}:00</span>
                </div>
                {diasSemana.map(dia => {
                  const ags = agendamentos.filter(ag => isSameDay(new Date(ag.scheduled_at), dia) && new Date(ag.scheduled_at).getHours() === hora);
                  return (
                    <div key={dia.toISOString()} className={cn("col-span-1 border-r border-slate-100 p-1 relative", isToday(dia) && "bg-blue-50/30")}>
                      {ags.map(ag => (
                        <div key={ag.id} className="bg-blue-600 border border-blue-700 rounded-md p-1 mb-1 shadow-sm overflow-hidden cursor-pointer hover:bg-blue-700">
                          <p className="text-[10px] font-bold text-white truncate">{ag.client_name}</p>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderVisaoMes = () => {
    const mesInicio = startOfMonth(selectedDate);
    const calendarioInicio = startOfWeek(mesInicio, { weekStartsOn: 0 });
    const calendarioFim = endOfWeek(endOfMonth(selectedDate), { weekStartsOn: 0 });
    const diasMes = eachDayOfInterval({ start: calendarioInicio, end: calendarioFim });
    const diasDaSemanaHeader = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    return (
      <div className="flex flex-col bg-white overflow-hidden p-4">
        <div className="grid grid-cols-7 mb-2">
          {diasDaSemanaHeader.map(d => (
            <div key={d} className="text-center font-bold text-xs text-slate-500 py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 border-t border-l border-slate-200">
          {diasMes.map((dia, i) => {
            const agsDoDia = agendamentos.filter(ag => isSameDay(new Date(ag.scheduled_at), dia));
            const isMesAtual = isSameMonth(dia, selectedDate);
            return (
              <div key={dia.toISOString()} className={cn("min-h-[100px] p-2 border-r border-b border-slate-200 relative", !isMesAtual && "bg-slate-50/50 opacity-50")}>
                <span className={cn("text-sm font-bold", isToday(dia) ? "bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center" : "text-slate-700")}>
                  {format(dia, 'd')}
                </span>
                
                <div className="mt-2 flex flex-col gap-1">
                  {agsDoDia.slice(0, 3).map(ag => (
                    <div key={ag.id} className="bg-blue-50 border border-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded truncate">
                      {new Date(ag.scheduled_at).getHours()}h - {ag.client_name.split(' ')[0]}
                    </div>
                  ))}
                  {agsDoDia.length > 3 && (
                    <div className="text-[10px] font-bold text-slate-500 mt-1 pl-1">+ {agsDoDia.length - 3} mais</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 p-2 md:p-6 bg-slate-50 min-h-[calc(100vh-4rem)]">
      
      {/* Cabeçalho Premium com Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm"><Calendar className="size-6 text-blue-600" /></div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900">Agenda</h2>
            <p className="text-sm text-slate-500 font-medium">Controle os horários e serviços do salão.</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          {/* Alternador de Visões */}
          <div className="flex bg-slate-200/50 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
            <Button variant="ghost" onClick={() => setViewMode("day")} className={cn("flex-1 sm:flex-none rounded-lg h-9 px-3 font-bold text-xs transition-all", viewMode === "day" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500")}>
              <CalendarDays className="size-4 mr-2" /> Dia
            </Button>
            <Button variant="ghost" onClick={() => setViewMode("week")} className={cn("flex-1 sm:flex-none rounded-lg h-9 px-3 font-bold text-xs transition-all", viewMode === "week" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500")}>
              <CalendarRange className="size-4 mr-2" /> Semana
            </Button>
            <Button variant="ghost" onClick={() => setViewMode("month")} className={cn("flex-1 sm:flex-none rounded-lg h-9 px-3 font-bold text-xs transition-all", viewMode === "month" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500")}>
              <CalendarIconMonth className="size-4 mr-2" /> Mês
            </Button>
            <Button variant="ghost" onClick={() => setViewMode("list")} className={cn("flex-1 sm:flex-none rounded-lg h-9 px-3 font-bold text-xs transition-all", viewMode === "list" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500")}>
              <LayoutList className="size-4 mr-2" /> Lista
            </Button>
          </div>
          <div className="hidden sm:block h-8 w-[1px] bg-slate-200" />
          <CreateAppointmentDialog onAppointmentCreated={fetchAgendamentos} />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center py-24 gap-3 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <Loader2 className="size-8 animate-spin text-blue-500" />
          <p className="text-slate-500 font-medium">Carregando horários...</p>
        </div>
      ) : viewMode !== "list" ? (
        <div className="flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {renderControlesDeNavegacao()}
          {viewMode === "day" && renderVisaoDia()}
          {viewMode === "week" && renderVisaoSemana()}
          {viewMode === "month" && renderVisaoMes()}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 border-b border-slate-100">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-bold text-slate-700">Data / Hora</TableHead>
                  <TableHead className="font-bold text-slate-700">Cliente</TableHead>
                  <TableHead className="font-bold text-slate-700">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agendamentos.map((ag) => (
                  <TableRow key={ag.id} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="font-bold text-slate-900">{formatarDataHora(ag.scheduled_at)}</TableCell>
                    <TableCell><p className="font-bold text-slate-800">{ag.client_name}</p></TableCell>
                    <TableCell>{getStatusBadge(ag.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}