// src/app/(dashboard)/perfil/horarios/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  Loader2, Save, Clock, Info, Calendar, ListOrdered, Shuffle, AlertTriangle, 
  Plus, Coffee, Palmtree, CalendarOff, Ban, Trash2 
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// --- Tipagens e Schemas do Expediente Semanal ---
const DIAS_SEMANA = [
  { id: 0, label: "Domingo" },
  { id: 1, label: "Segunda-feira" },
  { id: 2, label: "Terça-feira" },
  { id: 3, label: "Quarta-feira" },
  { id: 4, label: "Quinta-feira" },
  { id: 5, label: "Sexta-feira" },
  { id: 6, label: "Sábado" },
];

const scheduleSchema = z.object({
  schedule: z.array(
    z.object({
      day_of_week: z.number(),
      is_active: z.boolean(),
      start_time: z.string().min(5, "Obrigatório"),
      end_time: z.string().min(5, "Obrigatório"),
      service_mode: z.enum(['appointment', 'queue', 'hybrid']),
    })
  )
});

type ScheduleFormValues = z.infer<typeof scheduleSchema>;

interface DbSchedule {
  day_of_week: number;
  is_active: boolean;
  start_time: string;
  end_time: string;
  service_mode: 'appointment' | 'queue' | 'hybrid';
}

// --- Tipagens e Schemas de Pausas e Exceções ---
interface TimeBlock {
  id: string;
  block_date: string | null;
  start_time: string;
  end_time: string;
  type: 'lunch' | 'vacation' | 'holiday' | 'manual_block';
  reason: string | null;
}

const blockFormSchema = z.object({
  type: z.enum(['lunch', 'vacation', 'holiday', 'manual_block']),
  block_date: z.string().optional(),
  start_time: z.string().min(5, "Obrigatório"),
  end_time: z.string().min(5, "Obrigatório"),
  reason: z.string().max(255).optional(),
});

type BlockFormValues = z.infer<typeof blockFormSchema>;

export default function MeusHorariosPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [barbershopAcceptsWalkIn, setBarbershopAcceptsWalkIn] = useState(true);

  // Estados dos Bloqueios
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [isSavingBlock, setIsSavingBlock] = useState(false);

  const defaultSchedule: ScheduleFormValues["schedule"] = DIAS_SEMANA.map(dia => ({
    day_of_week: dia.id,
    is_active: dia.id !== 0,
    start_time: "09:00",
    end_time: "19:00",
    service_mode: "appointment"
  }));

  // Formulário do Expediente
  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: { schedule: defaultSchedule },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "schedule",
  });

  // Formulário de Bloqueios
  const blockForm = useForm<BlockFormValues>({
    resolver: zodResolver(blockFormSchema),
    defaultValues: {
      type: "lunch",
      block_date: "",
      start_time: "12:00",
      end_time: "13:00",
      reason: "",
    }
  });

  // Buscar Dados Iniciais
  useEffect(() => {
    async function fetchData() {
      try {
        // Busca Expediente
        const resSchedule = await fetch("/api/perfil/horarios");
        const jsonSchedule = await resSchedule.json();
        
        if (jsonSchedule.acceptsWalkIn !== undefined) {
          setBarbershopAcceptsWalkIn(jsonSchedule.acceptsWalkIn);
        }
        
        if (resSchedule.ok && jsonSchedule.data && Array.isArray(jsonSchedule.data) && jsonSchedule.data.length > 0) {
          const merged = defaultSchedule.map(defaultDay => {
            const dbDay = jsonSchedule.data.find((d: DbSchedule) => d.day_of_week === defaultDay.day_of_week);
            if (dbDay) {
              let finalMode = dbDay.service_mode || "appointment";
              if (jsonSchedule.acceptsWalkIn === false && finalMode !== "appointment") {
                finalMode = "appointment";
              }
              return {
                day_of_week: dbDay.day_of_week,
                is_active: dbDay.is_active,
                start_time: dbDay.start_time.substring(0, 5),
                end_time: dbDay.end_time.substring(0, 5),
                service_mode: finalMode,
              };
            }
            return defaultDay;
          });
          form.reset({ schedule: merged });
        }

        // Busca Bloqueios
        fetchBlocks();

      } catch (error: unknown) {
        toast.error("Falha ao carregar dados. Tente recarregar a página.");
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchBlocks() {
    try {
      const res = await fetch("/api/perfil/bloqueios");
      const json = await res.json();
      if (res.ok && json.data) {
        setTimeBlocks(json.data);
      }
    } catch (error) {
      console.error("Erro ao carregar bloqueios", error);
    }
  }

  // Submit Expediente
  async function onSubmit(data: ScheduleFormValues) {
    setIsSaving(true);
    const toastId = toast.loading("A guardar expedientes...");

    try {
      const res = await fetch("/api/perfil/horarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule: data.schedule }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erro ao guardar.");
      toast.success("Horários atualizados com sucesso!", { id: toastId });
    } catch (error: unknown) {
      if (error instanceof Error) toast.error(error.message, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  }

  // Submit Novo Bloqueio
  async function onBlockSubmit(data: BlockFormValues) {
    setIsSavingBlock(true);
    const toastId = toast.loading("Cadastrando pausa...");

    try {
      const payload = {
        ...data,
        block_date: data.block_date ? data.block_date : null // Limpa a data se for vazio (diário)
      };

      const res = await fetch("/api/perfil/bloqueios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erro ao criar bloqueio.");

      toast.success("Pausa adicionada com sucesso!", { id: toastId });
      fetchBlocks();
      setIsBlockModalOpen(false);
      blockForm.reset();
    } catch (error: unknown) {
      if (error instanceof Error) toast.error(error.message, { id: toastId });
    } finally {
      setIsSavingBlock(false);
    }
  }

  // Deletar Bloqueio
  async function handleDeleteBlock(id: string) {
    const toastId = toast.loading("Removendo pausa...");
    try {
      const res = await fetch(`/api/perfil/bloqueios?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao remover.");
      toast.success("Pausa removida.", { id: toastId });
      fetchBlocks();
    } catch (error: unknown) {
      if (error instanceof Error) toast.error(error.message, { id: toastId });
    }
  }

  // Helpers de UI para Bloqueios
  const getBlockIcon = (type: string) => {
    switch(type) {
      case 'lunch': return <Coffee className="size-5 text-amber-600" />;
      case 'vacation': return <Palmtree className="size-5 text-emerald-600" />;
      case 'holiday': return <CalendarOff className="size-5 text-blue-600" />;
      default: return <Ban className="size-5 text-red-600" />;
    }
  };

  const getBlockLabel = (type: string) => {
    switch(type) {
      case 'lunch': return "Horário de Almoço";
      case 'vacation': return "Férias";
      case 'holiday': return "Feriado / Folga";
      default: return "Bloqueio Manual";
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-slate-500">
        <Loader2 className="size-8 animate-spin text-blue-600" />
        <p className="font-medium">A carregar o seu perfil...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-2 sm:p-6 space-y-8 pb-20">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">O Meu Expediente</h1>
        <p className="text-slate-500 font-medium mt-1">
          Configure os dias, horários e modelo de atendimento para a sua rotina operacional.
        </p>
      </div>

      {!barbershopAcceptsWalkIn && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 items-start">
          <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 font-medium leading-relaxed">
            A gestão desativou o atendimento por <strong>Fila Virtual</strong> na barbearia. Neste momento, só é possível atender através de Agendamentos. As opções de fila encontram-se bloqueadas.
          </p>
        </div>
      )}

      {/* --- CARTÃO 1: EXPEDIENTE SEMANAL --- */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100 flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-200">
                  <Clock className="size-5 text-slate-700" />
                </div>
                <div>
                  <CardTitle className="text-xl">Horário Semanal</CardTitle>
                  <CardDescription className="text-slate-500 font-medium">Defina a sua rotina e modelo de atendimento.</CardDescription>
                </div>
              </div>
              <Button type="submit" disabled={isSaving} className="hidden sm:flex bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
                {isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                Guardar
              </Button>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-slate-100">
              {fields.map((field, index) => {
                const isActive = form.watch(`schedule.${index}.is_active`);
                const currentMode = form.watch(`schedule.${index}.service_mode`);

                return (
                  <div key={field.id} className={cn("p-4 sm:p-6 flex flex-col gap-6 transition-colors", !isActive && "bg-slate-50/50 opacity-70")}>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4 sm:w-1/3">
                        <FormField
                          control={form.control}
                          name={`schedule.${index}.is_active`}
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-emerald-500" />
                              </FormControl>
                              <span className={cn("font-bold text-lg", isActive ? "text-slate-900" : "text-slate-400")}>
                                {DIAS_SEMANA[index].label}
                              </span>
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="flex items-center gap-3 sm:w-2/3 max-w-sm ml-0 sm:ml-auto">
                        <FormField
                          control={form.control} name={`schedule.${index}.start_time`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl><Input type="time" disabled={!isActive} className={cn("h-12 rounded-xl text-center font-black text-base", !isActive && "text-slate-400 bg-slate-100")} {...field} /></FormControl>
                            </FormItem>
                          )}
                        />
                        <span className="text-slate-400 font-bold">até</span>
                        <FormField
                          control={form.control} name={`schedule.${index}.end_time`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl><Input type="time" disabled={!isActive} className={cn("h-12 rounded-xl text-center font-black text-base", !isActive && "text-slate-400 bg-slate-100")} {...field} /></FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {isActive && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                        <FormField
                          control={form.control} name={`schedule.${index}.service_mode`}
                          render={({ field }) => (
                            <FormItem className="col-span-1 sm:col-span-3">
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div onClick={() => field.onChange("appointment")} className={cn("flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all", currentMode === "appointment" ? "bg-blue-50 border-blue-500 shadow-sm" : "bg-white border-slate-200 hover:border-slate-300")}>
                                  <div className={cn("p-2.5 rounded-xl", currentMode === "appointment" ? "bg-blue-500 text-white" : "bg-slate-50 text-slate-500")}><Calendar className="size-5" /></div>
                                  <div className="flex flex-col"><span className="font-bold text-sm text-slate-800">Agendamentos</span><span className="text-xs text-slate-400">Horários reservados.</span></div>
                                </div>
                                <div onClick={() => barbershopAcceptsWalkIn && field.onChange("queue")} className={cn("flex items-center gap-3 p-4 rounded-2xl border transition-all", !barbershopAcceptsWalkIn ? "opacity-50 cursor-not-allowed bg-slate-50 border-slate-200" : currentMode === "queue" ? "bg-orange-50 border-orange-500 shadow-sm cursor-pointer" : "bg-white border-slate-200 hover:border-slate-300 cursor-pointer")}>
                                  <div className={cn("p-2.5 rounded-xl", currentMode === "queue" ? "bg-orange-500 text-white" : "bg-slate-50 text-slate-500")}><ListOrdered className="size-5" /></div>
                                  <div className="flex flex-col"><span className="font-bold text-sm text-slate-800">Fila Virtual</span><span className="text-xs text-slate-400">Ordem de chegada.</span></div>
                                </div>
                                <div onClick={() => barbershopAcceptsWalkIn && field.onChange("hybrid")} className={cn("flex items-center gap-3 p-4 rounded-2xl border transition-all", !barbershopAcceptsWalkIn ? "opacity-50 cursor-not-allowed bg-slate-50 border-slate-200" : currentMode === "hybrid" ? "bg-purple-50 border-purple-500 shadow-sm cursor-pointer" : "bg-white border-slate-200 hover:border-slate-300 cursor-pointer")}>
                                  <div className={cn("p-2.5 rounded-xl", currentMode === "hybrid" ? "bg-purple-500 text-white" : "bg-slate-50 text-slate-500")}><Shuffle className="size-5" /></div>
                                  <div className="flex flex-col"><span className="font-bold text-sm text-slate-800">Híbrido</span><span className="text-xs text-slate-400">Agenda e Fila juntos.</span></div>
                                </div>
                              </div>
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
          <div className="sm:hidden mt-4">
            <Button type="submit" disabled={isSaving} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black h-14 rounded-2xl shadow-lg">
              {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />} Guardar Expediente
            </Button>
          </div>
        </form>
      </Form>

      {/* --- CARTÃO 2: PAUSAS E EXCEÇÕES --- */}
      <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden mt-8">
        <CardHeader className="bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-200">
              <Coffee className="size-5 text-slate-700" />
            </div>
            <div>
              <CardTitle className="text-xl">Pausas & Exceções</CardTitle>
              <CardDescription className="text-slate-500 font-medium">Almoço diário, folgas e férias.</CardDescription>
            </div>
          </div>
          <Button onClick={() => setIsBlockModalOpen(true)} className="bg-white border border-slate-200 text-slate-800 hover:bg-slate-100 rounded-xl font-bold">
            <Plus className="size-4 mr-2" /> Adicionar Pausa
          </Button>
        </CardHeader>
        <CardContent className="p-0 divide-y divide-slate-100">
          {timeBlocks.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Coffee className="size-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium text-sm">Nenhuma pausa ou exceção cadastrada.</p>
            </div>
          ) : (
            timeBlocks.map((block) => (
              <div key={block.id} className="p-4 sm:p-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
                    {getBlockIcon(block.type)}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">{getBlockLabel(block.type)}</h4>
                    <div className="flex items-center text-sm font-medium text-slate-500 mt-1 gap-2">
                      <span className="bg-slate-100 px-2 py-0.5 rounded-md text-slate-700">
                        {block.start_time.substring(0,5)} às {block.end_time.substring(0,5)}
                      </span>
                      <span>•</span>
                      <span>
                        {block.block_date 
                          ? format(parseISO(block.block_date), "dd/MM/yyyy", { locale: ptBR }) 
                          : "Todos os dias"}
                      </span>
                    </div>
                    {block.reason && <p className="text-xs text-slate-400 mt-1.5 line-clamp-1">{block.reason}</p>}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDeleteBlock(block.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* MODAL DE CRIAÇÃO DE BLOQUEIO */}
      <Dialog open={isBlockModalOpen} onOpenChange={setIsBlockModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-slate-900">Nova Pausa</DialogTitle>
            <DialogDescription className="text-slate-500">O motor inteligente não irá gerar horários neste período.</DialogDescription>
          </DialogHeader>

          <Form {...blockForm}>
            <form onSubmit={blockForm.handleSubmit(onBlockSubmit)} className="space-y-4 mt-4">
              
              <FormField control={blockForm.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-bold text-slate-700">Tipo de Bloqueio</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-slate-50 border-slate-200 h-12 rounded-xl"><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="lunch"><div className="flex items-center"><Coffee className="size-4 mr-2 text-amber-600"/> Horário de Almoço</div></SelectItem>
                      <SelectItem value="manual_block"><div className="flex items-center"><Ban className="size-4 mr-2 text-red-600"/> Bloqueio Manual / Médico</div></SelectItem>
                      <SelectItem value="vacation"><div className="flex items-center"><Palmtree className="size-4 mr-2 text-emerald-600"/> Férias</div></SelectItem>
                      <SelectItem value="holiday"><div className="flex items-center"><CalendarOff className="size-4 mr-2 text-blue-600"/> Feriado / Folga</div></SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}/>

              <FormField control={blockForm.control} name="block_date" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-bold text-slate-700">Data <span className="text-slate-400 font-normal text-xs ml-1">(Deixe em branco para repetir todos os dias)</span></FormLabel>
                  <FormControl><Input type="date" className="bg-slate-50 border-slate-200 h-12 rounded-xl text-slate-700" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}/>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={blockForm.control} name="start_time" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold text-slate-700">Início</FormLabel>
                    <FormControl><Input type="time" className="bg-slate-50 border-slate-200 h-12 rounded-xl text-center font-bold" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
                <FormField control={blockForm.control} name="end_time" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold text-slate-700">Fim</FormLabel>
                    <FormControl><Input type="time" className="bg-slate-50 border-slate-200 h-12 rounded-xl text-center font-bold" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
              </div>

              <FormField control={blockForm.control} name="reason" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-bold text-slate-700">Motivo <span className="text-slate-400 font-normal text-xs ml-1">(Opcional)</span></FormLabel>
                  <FormControl><Input placeholder="Ex: Consulta dentista" className="bg-slate-50 border-slate-200 h-12 rounded-xl" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}/>

              <DialogFooter className="pt-4 mt-6 border-t border-slate-100">
                <Button type="button" variant="ghost" onClick={() => setIsBlockModalOpen(false)} className="rounded-xl font-bold">Cancelar</Button>
                <Button type="submit" disabled={isSavingBlock} className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold">
                  {isSavingBlock && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Cadastrar Pausa
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}