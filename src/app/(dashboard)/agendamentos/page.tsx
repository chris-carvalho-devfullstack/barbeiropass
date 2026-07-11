// src/app/(dashboard)/agendamentos/page.tsx
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { 
  Calendar, Loader2, CheckCircle, XCircle, Clock, 
  Scissors, Wallet, LayoutList, CalendarDays, 
  ChevronLeft, ChevronRight, CalendarRange, Calendar as CalendarIconMonth,
  UserCircle2, UserX, Filter
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CreateAppointmentDialog } from "@/components/create-appointment-dialog";
import { AppointmentDetailsDialog, AppointmentData } from "@/components/appointment-details-dialog";
import { cn } from "@/lib/utils";

type ViewMode = "day" | "week" | "month" | "list";
type ListFilter = "upcoming" | "completed" | "no_show" | "all";

interface ServiceItem {
  id: string;
  name: string;
  price?: number;
  duration_minutes?: number;
}

// Subcomponente Elegante para Exibir os Múltiplos Serviços
function ServicesDisplay({ services }: { services: ServiceItem[] }) {
  if (!services || services.length === 0) return <span className="text-sm text-slate-500">Sem serviço</span>;

  const firstService = services[0];
  const remaining = services.length - 1;

  return (
    <div className="flex items-center gap-1.5 truncate">
      {/* CORREÇÃO DO ESLINT: Usando classes canônicas max-w-30 e sm:max-w-40 */}
      <span className="truncate max-w-30 sm:max-w-40">{firstService.name}</span>
      {remaining > 0 && (
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="h-5 px-1.5 cursor-help text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-700">
                +{remaining}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="flex flex-col gap-1 p-2 bg-slate-800 text-white border-slate-700">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Todos os Serviços:</span>
              {services.map((s, index) => (
                <span key={s.id || index.toString()} className="text-xs font-medium">• {s.name}</span>
              ))}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

export default function AgendamentosPage() {
  const [agendamentos, setAgendamentos] = useState<AppointmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  
  const [listFilter, setListFilter] = useState<ListFilter>("upcoming");

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentData | null>(null);
  const [appointmentToEdit, setAppointmentToEdit] = useState<AppointmentData | null>(null);
  
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const currentHourRef = useRef<HTMLDivElement | null>(null);

  const fetchAgendamentos = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/agendamentos");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Erro ao buscar agendamentos.");
      
      const sortedData = (result.data as AppointmentData[]).sort((a, b) => {
        return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
      });
      
      setAgendamentos(sortedData);
    } catch (error: unknown) {
      if (error instanceof Error) toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgendamentos();
  }, [fetchAgendamentos]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isToday(selectedDate) && (viewMode === "day" || viewMode === "week")) {
      setTimeout(() => {
        currentHourRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }, [selectedDate, viewMode, loading]);

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
      case "scheduled": return <Badge className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"><Clock className="h-3 w-3 mr-1"/> Agendado</Badge>;
      case "in_progress": return <Badge className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"><Scissors className="h-3 w-3 mr-1"/> Na Cadeira</Badge>;
      case "completed": return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"><CheckCircle className="h-3 w-3 mr-1"/> Concluído</Badge>;
      case "canceled": return <Badge className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100"><XCircle className="h-3 w-3 mr-1"/> Cancelado</Badge>;
      case "awaiting_payment": return <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"><Wallet className="h-3 w-3 mr-1"/> Aguardando Pag.</Badge>;
      case "no_show": return <Badge className="bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"><UserX className="h-3 w-3 mr-1"/> Faltou</Badge>;
      default: return <Badge variant="outline" className="capitalize">{status.replace('_', ' ')}</Badge>;
    }
  };

  const getBarberName = (staff: AppointmentData["staff"]) => {
    if (!staff || !staff.profiles) return "Não atribuído";
    if (Array.isArray(staff.profiles)) {
      return staff.profiles[0]?.full_name || "Não atribuído";
    }
    return staff.profiles.full_name || "Não atribuído";
  };

  const horasDoDia = Array.from({ length: 24 }, (_, i) => i);

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
      <div className="relative min-h-150 overflow-y-auto p-4 sm:p-6 bg-slate-50/30">
        {horasDoDia.map((hora) => {
          const agendamentosNestaHora = agendamentosDoDia.filter(ag => new Date(ag.scheduled_at).getHours() === hora);
          const isCurrentHour = isToday(selectedDate) && currentTime.getHours() === hora;
          const minutosPorcentagem = (currentTime.getMinutes() / 60) * 100;

          return (
            <div 
              key={hora} 
              ref={isCurrentHour ? currentHourRef : null}
              className="relative flex min-h-20 border-b border-slate-200/60 last:border-0"
            >
              <div className="w-16 shrink-0 text-right pr-4 pt-2">
                <span className={cn("text-sm font-bold", isCurrentHour ? "text-red-500" : "text-slate-400")}>
                  {hora.toString().padStart(2, '0')}:00
                </span>
              </div>
              
              <div className="relative flex-1 bg-white/50 border-l border-slate-200/60 group hover:bg-white transition-colors">
                
                {isCurrentHour && (
                  <div 
                    className="absolute left-0 right-0 z-10 flex items-center pointer-events-none"
                    style={{ top: `${minutosPorcentagem}%`, transform: 'translateY(-50%)' }}
                  >
                    <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shadow-sm shadow-red-500/50"></div>
                    <div className="h-0.5 w-full bg-red-500/60"></div>
                  </div>
                )}

                {agendamentosNestaHora.map((ag) => {
                  const minutos = new Date(ag.scheduled_at).getMinutes();
                  
                  const currentServices = (Array.isArray(ag.services) ? ag.services : (ag.services ? [ag.services] : [])) as ServiceItem[];
                  const totalDuration = currentServices.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0) || 30;

                  return (
                    <div 
                      key={ag.id} 
                      onClick={() => setSelectedAppointment(ag)}
                      className="m-2 p-3 rounded-xl border border-blue-100 bg-blue-50/50 hover:bg-blue-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm cursor-pointer relative z-20"
                    >
                      <div className="flex items-start gap-3">
                        <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-100 mt-1 sm:mt-0">
                          <span className="text-sm font-black text-blue-700">{hora.toString().padStart(2, '0')}:{minutos.toString().padStart(2, '0')}</span>
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{ag.client_name}</p>
                          <div className="flex items-center gap-2 mt-1 text-sm text-slate-500 font-medium">
                            <ServicesDisplay services={currentServices} />
                            <span>•</span>
                            <span>{totalDuration} min</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-600 font-medium bg-white w-fit px-2 py-0.5 rounded-md border border-slate-200 shadow-sm">
                            <UserCircle2 className="w-3 h-3 text-blue-600" />
                            <span>{getBarberName(ag.staff)}</span>
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
    const inicioSemana = startOfWeek(selectedDate, { weekStartsOn: 0 });
    const diasSemana = eachDayOfInterval({ start: inicioSemana, end: endOfWeek(selectedDate, { weekStartsOn: 0 }) });
    
    return (
      <div className="flex flex-col bg-white overflow-hidden">
        <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50 sticky top-0 z-30">
          <div className="col-span-1 p-2 border-r border-slate-200"></div>
          {diasSemana.map(dia => (
            <div key={dia.toISOString()} className={cn("col-span-1 p-3 text-center border-r border-slate-200 last:border-0", isToday(dia) && "bg-blue-50")}>
              <p className="text-xs font-bold text-slate-500 uppercase">
                {format(dia, 'EEE', { locale: ptBR }).replace('.', '').substring(0, 3)}
              </p>
              <p className={cn("text-lg font-black", isToday(dia) ? "text-blue-600" : "text-slate-800")}>{format(dia, 'd')}</p>
            </div>
          ))}
        </div>
        
        <div className="overflow-y-auto max-h-150 overflow-x-auto relative">
          <div className="min-w-200">
            {horasDoDia.map((hora) => {
              const isCurrentHourRow = isToday(selectedDate) && currentTime.getHours() === hora;
              return (
                <div 
                  key={hora} 
                  ref={isCurrentHourRow ? currentHourRef : null}
                  className="grid grid-cols-8 border-b border-slate-100 min-h-20"
                >
                  <div className="col-span-1 border-r border-slate-200 p-2 text-right">
                    <span className={cn("text-xs font-bold", isCurrentHourRow ? "text-red-500" : "text-slate-400")}>
                      {hora.toString().padStart(2, '0')}:00
                    </span>
                  </div>
                  {diasSemana.map(dia => {
                    const ags = agendamentos.filter(ag => isSameDay(new Date(ag.scheduled_at), dia) && new Date(ag.scheduled_at).getHours() === hora);
                    const isTodayAndCurrentHour = isToday(dia) && currentTime.getHours() === hora;
                    const minutosPorcentagem = (currentTime.getMinutes() / 60) * 100;

                    return (
                      <div key={dia.toISOString()} className={cn("col-span-1 border-r border-slate-100 p-1 relative", isToday(dia) && "bg-blue-50/30")}>
                        
                        {isTodayAndCurrentHour && (
                          <div 
                            className="absolute left-0 right-0 z-10 flex items-center pointer-events-none"
                            style={{ top: `${minutosPorcentagem}%`, transform: 'translateY(-50%)' }}
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 -ml-0.75"></div>
                            <div className="h-0.5 w-full bg-red-500/60"></div>
                          </div>
                        )}

                        {ags.map(ag => (
                          <div 
                            key={ag.id} 
                            onClick={() => setSelectedAppointment(ag)}
                            className="bg-blue-600 border border-blue-700 rounded-md p-1 mb-1 shadow-sm overflow-hidden cursor-pointer hover:bg-blue-700 relative z-20" 
                            title={getBarberName(ag.staff)}
                          >
                            <p className="text-[10px] font-bold text-white truncate">{ag.client_name}</p>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })}
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
          {diasMes.map((dia) => {
            const agsDoDia = agendamentos.filter(ag => isSameDay(new Date(ag.scheduled_at), dia));
            const isMesAtual = isSameMonth(dia, selectedDate);
            return (
              <div key={dia.toISOString()} className={cn("min-h-25 p-2 border-r border-b border-slate-200 relative", !isMesAtual && "bg-slate-50/50 opacity-50")}>
                <span className={cn("text-sm font-bold", isToday(dia) ? "bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center" : "text-slate-700")}>
                  {format(dia, 'd')}
                </span>
                
                <div className="mt-2 flex flex-col gap-1">
                  {agsDoDia.slice(0, 3).map(ag => (
                    <div 
                      key={ag.id} 
                      onClick={() => setSelectedAppointment(ag)}
                      className="bg-blue-50 border border-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded truncate cursor-pointer hover:bg-blue-100 transition-colors" 
                      title={getBarberName(ag.staff)}
                    >
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

  const getFilteredList = () => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0); 

    return agendamentos.filter((ag) => {
      const isPast = new Date(ag.scheduled_at) < hoje;

      switch (listFilter) {
        case "upcoming":
          return !isPast && ["scheduled", "in_progress", "awaiting_payment"].includes(ag.status);
        case "completed":
          return ag.status === "completed";
        case "no_show":
          return ag.status === "no_show" || ag.status === "canceled";
        case "all":
        default:
          return true;
      }
    }).sort((a, b) => {
      const timeA = new Date(a.scheduled_at).getTime();
      const timeB = new Date(b.scheduled_at).getTime();
      return (listFilter === "completed" || listFilter === "no_show") ? timeB - timeA : timeA - timeB;
    });
  };

  const renderVisaoLista = () => {
    const filteredAgendamentos = getFilteredList();

    return (
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
            <Filter className="w-4 h-4 text-slate-400" /> Exibindo: 
          </div>
          <div className="flex bg-slate-200/50 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
            <Button 
              variant="ghost" 
              onClick={() => setListFilter("upcoming")} 
              className={cn("flex-1 sm:flex-none rounded-lg h-8 px-3 font-bold text-xs transition-all", listFilter === "upcoming" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500")}
            >
              Próximos
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => setListFilter("completed")} 
              className={cn("flex-1 sm:flex-none rounded-lg h-8 px-3 font-bold text-xs transition-all", listFilter === "completed" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500")}
            >
              Concluídos
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => setListFilter("no_show")} 
              className={cn("flex-1 sm:flex-none rounded-lg h-8 px-3 font-bold text-xs transition-all", listFilter === "no_show" ? "bg-white text-orange-700 shadow-sm" : "text-slate-500")}
            >
              Cancelados/Faltas
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => setListFilter("all")} 
              className={cn("flex-1 sm:flex-none rounded-lg h-8 px-3 font-bold text-xs transition-all", listFilter === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}
            >
              Histórico Completo
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-white border-b border-slate-100">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-bold text-slate-700">Data / Hora</TableHead>
                <TableHead className="font-bold text-slate-700">Cliente</TableHead>
                <TableHead className="font-bold text-slate-700">Profissional</TableHead>
                <TableHead className="font-bold text-slate-700">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAgendamentos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-slate-500 font-medium">
                    Nenhum agendamento encontrado para este filtro.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAgendamentos.map((ag) => (
                  <TableRow 
                    key={ag.id} 
                    onClick={() => setSelectedAppointment(ag)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <TableCell className="font-bold text-slate-900">{formatarDataHora(ag.scheduled_at)}</TableCell>
                    <TableCell><p className="font-bold text-slate-800">{ag.client_name}</p></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-slate-600">
                        <UserCircle2 className="w-4 h-4 text-slate-400" />
                        <span className="font-medium text-sm">{getBarberName(ag.staff)}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(ag.status)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 p-2 md:p-6 bg-slate-50 min-h-[calc(100vh-4rem)]">
      
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm"><Calendar className="size-6 text-blue-600" /></div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900">Agenda</h2>
            <p className="text-sm text-slate-500 font-medium">Controle os horários e serviços do salão.</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
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
          <div className="hidden sm:block h-8 w-px bg-slate-200" />
          
          <CreateAppointmentDialog 
            onAppointmentCreated={fetchAgendamentos} 
          />
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
        renderVisaoLista()
      )}

      {/* Renderização do Modal de Detalhes */}
      <AppointmentDetailsDialog 
        appointment={selectedAppointment}
        isOpen={!!selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
        onUpdate={fetchAgendamentos}
        onEdit={(appt) => {
          setAppointmentToEdit(appt); 
        }}
      />

      {/* Renderização do Modal de Edição */}
      {appointmentToEdit && (
        <CreateAppointmentDialog 
          isOpen={!!appointmentToEdit}
          onOpenChange={(open) => {
            if (!open) setAppointmentToEdit(null);
          }}
          appointmentToEdit={appointmentToEdit}
          onAppointmentCreated={() => {
            fetchAgendamentos();
            setAppointmentToEdit(null);
          }} 
        />
      )}
    </div>
  );
}