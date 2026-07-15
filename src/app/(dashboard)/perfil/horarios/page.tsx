// src/app/(dashboard)/perfil/horarios/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Save, Clock, Info, Calendar, ListOrdered, Shuffle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

export default function MeusHorariosPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [barbershopAcceptsWalkIn, setBarbershopAcceptsWalkIn] = useState(true);

  const defaultSchedule: ScheduleFormValues["schedule"] = DIAS_SEMANA.map(dia => ({
    day_of_week: dia.id,
    is_active: dia.id !== 0,
    start_time: "09:00",
    end_time: "19:00",
    service_mode: "appointment"
  }));

  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: { schedule: defaultSchedule },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "schedule",
  });

  useEffect(() => {
    async function fetchHorarios() {
      try {
        const res = await fetch("/api/perfil/horarios");
        const json = await res.json();
        
        // NOVO: Lê a permissão global da barbearia
        if (json.acceptsWalkIn !== undefined) {
          setBarbershopAcceptsWalkIn(json.acceptsWalkIn);
        }
        
        if (res.ok && json.data && Array.isArray(json.data) && json.data.length > 0) {
          const merged = defaultSchedule.map(defaultDay => {
            const dbDay = json.data.find((d: DbSchedule) => d.day_of_week === defaultDay.day_of_week);
            if (dbDay) {
              
              // Se a barbearia não aceitar fila, forçamos o modo "appointment" para não quebrar a UI
              let finalMode = dbDay.service_mode || "appointment";
              if (json.acceptsWalkIn === false && finalMode !== "appointment") {
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
      } catch (error: unknown) {
        toast.error("Falha ao carregar horários. Tente recarregar a página.");
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchHorarios();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      if (error instanceof Error) {
        toast.error(error.message, { id: toastId });
      } else {
        toast.error("Ocorreu um erro inesperado.", { id: toastId });
      }
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-slate-500">
        <Loader2 className="size-8 animate-spin text-blue-600" />
        <p className="font-medium">A carregar o seu expediente...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-2 sm:p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">O Meu Expediente</h1>
        <p className="text-slate-500 font-medium mt-1">
          Configure os dias, horários e modelo de atendimento para a sua rotina operacional.
        </p>
      </div>

      {barbershopAcceptsWalkIn ? (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3 items-start">
          <Info className="size-5 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800 font-medium leading-relaxed">
            A sua barbearia suporta tanto horários reservados quanto fila virtual. Defina abaixo como planeia atuar em cada dia da semana. Configurar o dia como <strong>Fila Virtual</strong> fará com que não exiba horários para agendamento manual neste dia.
          </p>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 items-start">
          <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 font-medium leading-relaxed">
            A gestão desativou o atendimento por <strong>Fila Virtual</strong> na barbearia. Neste momento, só é possível atender através de Agendamentos. As opções de fila encontram-se bloqueadas.
          </p>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-200">
                  <Clock className="size-5 text-slate-700" />
                </div>
                <div>
                  <CardTitle className="text-xl">Horário Semanal</CardTitle>
                  <CardDescription className="text-slate-500 font-medium">Defina a sua rotina e modelo de atendimento.</CardDescription>
                </div>
              </div>
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
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  className="data-[state=checked]:bg-emerald-500"
                                />
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
                          control={form.control}
                          name={`schedule.${index}.start_time`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input 
                                  type="time" 
                                  disabled={!isActive}
                                  className={cn("h-12 rounded-xl text-center font-black text-base", !isActive && "text-slate-400 bg-slate-100")}
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <span className="text-slate-400 font-bold">até</span>
                        
                        <FormField
                          control={form.control}
                          name={`schedule.${index}.end_time`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input 
                                  type="time" 
                                  disabled={!isActive}
                                  className={cn("h-12 rounded-xl text-center font-black text-base", !isActive && "text-slate-400 bg-slate-100")}
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {isActive && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                        <FormField
                          control={form.control}
                          name={`schedule.${index}.service_mode`}
                          render={({ field }) => (
                            <FormItem className="col-span-1 sm:col-span-3">
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                
                                {/* Opção: Somente Agendamentos (Sempre disponível) */}
                                <div 
                                  onClick={() => field.onChange("appointment")}
                                  className={cn(
                                    "flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]",
                                    currentMode === "appointment" 
                                      ? "bg-blue-50 border-blue-500 shadow-sm" 
                                      : "bg-white border-slate-200 hover:border-slate-300"
                                  )}
                                >
                                  <div className={cn("p-2.5 rounded-xl", currentMode === "appointment" ? "bg-blue-500 text-white" : "bg-slate-50 text-slate-500")}>
                                    <Calendar className="size-5" />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="font-bold text-sm text-slate-800">Agendamentos</span>
                                    <span className="text-xs text-slate-400">Horários reservados.</span>
                                  </div>
                                </div>

                                {/* Opção: Somente Fila Virtual (Bloqueada se acceptsWalkIn for false) */}
                                <div 
                                  onClick={() => barbershopAcceptsWalkIn && field.onChange("queue")}
                                  className={cn(
                                    "flex items-center gap-3 p-4 rounded-2xl border transition-all",
                                    !barbershopAcceptsWalkIn 
                                      ? "opacity-50 cursor-not-allowed bg-slate-50 border-slate-200" 
                                      : currentMode === "queue" 
                                        ? "bg-orange-50 border-orange-500 shadow-sm cursor-pointer hover:scale-[1.01] active:scale-[0.99]" 
                                        : "bg-white border-slate-200 hover:border-slate-300 cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
                                  )}
                                >
                                  <div className={cn("p-2.5 rounded-xl", currentMode === "queue" ? "bg-orange-500 text-white" : "bg-slate-50 text-slate-500")}>
                                    <ListOrdered className="size-5" />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="font-bold text-sm text-slate-800">Fila Virtual</span>
                                    <span className="text-xs text-slate-400">Ordem de chegada.</span>
                                  </div>
                                </div>

                                {/* Opção: Híbrido (Bloqueada se acceptsWalkIn for false) */}
                                <div 
                                  onClick={() => barbershopAcceptsWalkIn && field.onChange("hybrid")}
                                  className={cn(
                                    "flex items-center gap-3 p-4 rounded-2xl border transition-all",
                                    !barbershopAcceptsWalkIn 
                                      ? "opacity-50 cursor-not-allowed bg-slate-50 border-slate-200" 
                                      : currentMode === "hybrid" 
                                        ? "bg-purple-50 border-purple-500 shadow-sm cursor-pointer hover:scale-[1.01] active:scale-[0.99]" 
                                        : "bg-white border-slate-200 hover:border-slate-300 cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
                                  )}
                                >
                                  <div className={cn("p-2.5 rounded-xl", currentMode === "hybrid" ? "bg-purple-500 text-white" : "bg-slate-50 text-slate-500")}>
                                    <Shuffle className="size-5" />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="font-bold text-sm text-slate-800">Híbrido</span>
                                    <span className="text-xs text-slate-400">Agenda e Fila juntos.</span>
                                  </div>
                                </div>

                              </div>
                              <FormMessage />
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

          <div className="mt-8 flex justify-end">
            <Button 
              type="submit" 
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white font-black h-14 px-8 rounded-2xl shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98] w-full sm:w-auto"
            >
              {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
              Guardar Alterações
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}