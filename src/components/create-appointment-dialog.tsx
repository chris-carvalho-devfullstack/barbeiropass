// src/components/create-appointment-dialog.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { Loader2, CalendarClock, Check, ChevronsUpDown, Scissors, Clock, Edit } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// Importando a tipagem de dados vinda do modal de detalhes (se estiver no mesmo diretório, ou ajustamos aqui)
type AppointmentData = {
  id: string;
  scheduled_at: string;
  status: "scheduled" | "in_progress" | "completed" | "canceled" | "awaiting_payment" | "no_show";
  client_name: string;
  client_phone: string | null;
  services: { id?: string; name: string; price: number; duration_minutes: number; } | null;
  staff: { profiles: { full_name: string | null } | { full_name: string | null }[] | null } | null;
  barber_id?: string; // Garantindo que o barber_id venha para edição
};

const formSchema = z.object({
  client_name: z.string().min(3, "Nome muito curto"),
  client_phone: z.string().optional(),
  scheduled_date: z.string().min(10, "Data é obrigatória"), // Separado para UX melhorada
  scheduled_time: z.string().min(4, "Horário é obrigatório"), // Separado para UX melhorada
  barber_id: z.string().optional(),
  service_ids: z.array(z.string()), 
});

type AppointmentFormValues = z.infer<typeof formSchema>;

interface SugestaoCliente {
  id: string;
  name: string;
  phone: string | null;
}

interface BarberOption {
  id: string;
  name: string;
  role: string;
}

interface ServiceOption {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
}

interface OptionsData {
  isManager: boolean;
  currentUserId: string;
  barbers: BarberOption[];
  services: ServiceOption[];
}

const traduzirCargo = (role: string) => {
  const cargos: Record<string, string> = {
    barber: 'Barbeiro',
    manager: 'Gerente',
    owner: 'Dono',
  };
  return cargos[role] || role;
};

// --- NOVAS PROPRIEDADES ---
// isOpen e onOpenChange permitem que a página controle a abertura para o modo edição.
// appointmentToEdit fornece os dados a serem editados.
export function CreateAppointmentDialog({ 
  onAppointmentCreated, 
  isOpen, 
  onOpenChange,
  appointmentToEdit
}: { 
  onAppointmentCreated: () => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  appointmentToEdit?: AppointmentData | null;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isModalOpen = isOpen !== undefined ? isOpen : internalOpen;
  const setModalOpen = onOpenChange !== undefined ? onOpenChange : setInternalOpen;
  const isEditing = !!appointmentToEdit;

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sugestoes, setSugestoes] = useState<SugestaoCliente[]>([]);
  const [options, setOptions] = useState<OptionsData | null>(null);

  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
      client_name: "", 
      client_phone: "", 
      scheduled_date: format(new Date(), "yyyy-MM-dd"), // Data padrão hoje
      scheduled_time: "", 
      service_ids: [], 
      barber_id: "" 
    },
  });

  // Preencher formulário se for modo de edição
  useEffect(() => {
    if (isModalOpen && isEditing && appointmentToEdit) {
      const dt = new Date(appointmentToEdit.scheduled_at);
      form.reset({
        client_name: appointmentToEdit.client_name,
        client_phone: appointmentToEdit.client_phone || "",
        scheduled_date: format(dt, "yyyy-MM-dd"),
        scheduled_time: format(dt, "HH:mm"),
        barber_id: appointmentToEdit.barber_id || options?.currentUserId || "",
        service_ids: appointmentToEdit.services?.id ? [appointmentToEdit.services.id] : [],
      });
    } else if (isModalOpen && !isEditing) {
      // Se for criar novo, reseta pro padrão
      form.reset({
        client_name: "", 
        client_phone: "", 
        scheduled_date: format(new Date(), "yyyy-MM-dd"),
        scheduled_time: "", 
        service_ids: [], 
        barber_id: options?.currentUserId || "" 
      });
    }
  }, [isModalOpen, isEditing, appointmentToEdit, form, options?.currentUserId]);

  useEffect(() => {
    if (isModalOpen && !options) {
      fetch("/api/agendamentos/opcoes")
        .then(res => res.json())
        .then(res => {
          if (res.data) {
            setOptions(res.data as OptionsData);
            if (!isEditing) {
              form.setValue("barber_id", res.data.currentUserId);
            }
          }
        })
        .catch(err => console.error("Erro ao carregar opções:", err));
    }
  }, [isModalOpen, options, form, isEditing]);

  useEffect(() => {
    const buscarClientes = async () => {
      if (searchTerm.trim().length < 2) {
        setSugestoes([]);
        return;
      }
      try {
        const res = await fetch(`/api/clientes/search?q=${encodeURIComponent(searchTerm)}`);
        const result = await res.json();
        if (res.ok && result.data) {
          setSugestoes(result.data as SugestaoCliente[]);
        }
      } catch (error: unknown) {
        console.error("Erro na busca de clientes:", error);
      }
    };
    const timer = setTimeout(buscarClientes, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const selectedServiceIds = form.watch("service_ids");
  const selectedDate = form.watch("scheduled_date");
  const selectedTime = form.watch("scheduled_time");
  
  const totais = useMemo(() => {
    if (!options) return { tempo: 0, preco: 0 };
    return selectedServiceIds.reduce((acc, id) => {
      const s = options.services.find(x => x.id === id);
      return s ? { tempo: acc.tempo + s.duration_minutes, preco: acc.preco + s.price } : acc;
    }, { tempo: 0, preco: 0 });
  }, [selectedServiceIds, options]);

  // SIMULAÇÃO DE HORÁRIOS DISPONÍVEIS (Mocking Phase 4)
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let h = 9; h <= 19; h++) {
      slots.push(`${h.toString().padStart(2, '0')}:00`);
      slots.push(`${h.toString().padStart(2, '0')}:30`);
    }
    return slots;
  }, []);

  async function onSubmit(values: AppointmentFormValues) {
    setIsSubmitting(true);
    const toastId = toast.loading(isEditing ? "Atualizando horário..." : "Agendando horário...");
    const tempoCalculado = totais.tempo > 0 ? totais.tempo : 30;

    // Combina a data e hora separadas num único ISO string pro Supabase
    const scheduledDateTime = new Date(`${values.scheduled_date}T${values.scheduled_time}:00`).toISOString();

    try {
      const endpoint = isEditing ? `/api/agendamentos/${appointmentToEdit.id}` : "/api/agendamentos";
      const method = isEditing ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: values.client_name,
          client_phone: values.client_phone || null,
          scheduled_at: scheduledDateTime,
          barber_id: values.barber_id || options?.currentUserId,
          service_ids: values.service_ids,
          duration_minutes: tempoCalculado, 
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Falha ao gravar agendamento.");
      }

      toast.success(isEditing ? "Agendamento atualizado!" : "Agendamento criado com sucesso!", { id: toastId });
      form.reset();
      setSearchTerm("");
      setSugestoes([]);
      setModalOpen(false);
      onAppointmentCreated();
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(`Atenção: ${error.message}`, { id: toastId });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const toggleService = (id: string) => {
    const atual = form.getValues("service_ids");
    form.setValue("service_ids", atual.includes(id) ? atual.filter(x => x !== id) : [...atual, id]);
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={setModalOpen}>
      {/* Esconde o botão disparador se o modal for controlado externamente (Edição) */}
      {!onOpenChange && (
        <DialogTrigger asChild>
          <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md font-bold transition-all active:scale-95">
            <CalendarClock className="size-4" /> Novo Horário
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-xl bg-white border-none shadow-2xl rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-slate-900 flex items-center gap-2">
            {isEditing ? <><Edit className="text-blue-600 w-6 h-6"/> Editar Agendamento</> : "Agendar Cliente"}
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            {isEditing ? "Modifique os detalhes deste agendamento." : "Configure os serviços e o tempo estimado."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-2">
            
            {options?.isManager && (
              <FormField control={form.control} name="barber_id" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-bold text-slate-700">Profissional</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-slate-50 border-slate-200 h-12 rounded-xl">
                        <SelectValue placeholder="Selecione o profissional" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {options.barbers.map(b => (
                        <SelectItem key={b.id} value={b.id} className="font-bold text-slate-800">
                          {b.name} <span className="text-slate-400 font-normal text-xs ml-2">({traduzirCargo(b.role)})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}/>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control} name="client_name"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="font-bold text-slate-700">Nome do Cliente</FormLabel>
                    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline" role="combobox"
                            className={cn("justify-between bg-slate-50 border-slate-200 h-12 text-base rounded-xl", !field.value && "text-muted-foreground")}
                          >
                            <span className="truncate">{field.value || "Selecionar cliente..."}</span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 border-slate-200 shadow-xl rounded-xl overflow-hidden bg-white">
                        <Command shouldFilter={false}>
                          <CommandInput placeholder="Pesquise por nome..." onValueChange={setSearchTerm} className="h-12"/>
                          <CommandList>
                            <CommandEmpty className="p-4 text-sm text-center">
                              <p className="text-slate-500 mb-2">Nenhum cadastro encontrado.</p>
                              <Button 
                                type="button" variant="secondary" className="w-full text-blue-600 font-bold"
                                onClick={() => { field.onChange(searchTerm); setPopoverOpen(false); }}
                              >
                                Usar &quot;{searchTerm}&quot;
                              </Button>
                            </CommandEmpty>
                            <CommandGroup title="Sugestões do Banco">
                              {sugestoes.map((c) => (
                                <CommandItem
                                  key={c.id} value={c.name}
                                  onSelect={() => {
                                    field.onChange(c.name);
                                    if (c.phone) form.setValue("client_phone", c.phone);
                                    setPopoverOpen(false);
                                  }}
                                  className="flex flex-col items-start py-3 cursor-pointer border-b border-slate-50 last:border-0"
                                >
                                  <div className="flex items-center w-full">
                                    <Check className={cn("mr-2 h-4 w-4 text-blue-600", c.name === field.value ? "opacity-100" : "opacity-0")} />
                                    <span className="font-bold text-slate-800">{c.name}</span>
                                  </div>
                                  {c.phone && <span className="text-xs text-slate-400 ml-6 font-mono">{c.phone}</span>}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control} name="client_phone"
                render={({ field }) => (
                  <FormItem><FormLabel className="font-bold text-slate-700">WhatsApp</FormLabel>
                    <FormControl><Input className="bg-slate-50 border-slate-200 h-12 rounded-xl" placeholder="(11) 99999-9999" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* EXPERIÊNCIA DE DATA E HORA APRIMORADA COM CARDS */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <FormLabel className="font-bold text-slate-700 mb-3 block">Quando será o atendimento?</FormLabel>
              <div className="flex flex-col gap-4">
                
                <FormField
                  control={form.control} name="scheduled_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input type="date" className="bg-white border-slate-200 h-12 rounded-xl font-bold text-slate-700" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedDate && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase">Horários</p>
                    <FormField
                      control={form.control} name="scheduled_time"
                      render={({ field }) => (
                        <FormItem>
                          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-40 overflow-y-auto pr-1">
                            {timeSlots.map((time) => {
                              // Simulação de horário ocupado (Ex: Meio-dia)
                              const isOccupied = time === "12:00" && selectedDate === format(new Date(), "yyyy-MM-dd");
                              const isSelected = field.value === time;

                              return (
                                <div
                                  key={time}
                                  onClick={() => !isOccupied && field.onChange(time)}
                                  className={cn(
                                    "flex items-center justify-center p-2 rounded-lg text-sm font-bold border transition-all cursor-pointer",
                                    isOccupied 
                                      ? "bg-slate-100 text-slate-400 border-slate-200 opacity-60 cursor-not-allowed line-through"
                                      : isSelected
                                      ? "bg-blue-600 text-white border-blue-600 shadow-md"
                                      : "bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:text-blue-700"
                                  )}
                                >
                                  {time}
                                </div>
                              );
                            })}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* SELEÇÃO MÚLTIPLA DE SERVIÇOS */}
            {options && options.services.length > 0 && (
              <div className="pt-2">
                <FormLabel className="font-bold text-slate-700 mb-2 block">Serviços do Atendimento</FormLabel>
                <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1">
                  {options.services.map(servico => {
                    const isSelected = selectedServiceIds.includes(servico.id);
                    return (
                      <div 
                        key={servico.id} onClick={() => toggleService(servico.id)}
                        className={cn("border rounded-xl p-3 cursor-pointer transition-all flex flex-col gap-1", isSelected ? "bg-blue-50 border-blue-600 shadow-sm" : "bg-white border-slate-200 hover:border-slate-300")}
                      >
                        <div className="flex items-center justify-between">
                          <span className={cn("font-bold text-sm leading-tight", isSelected ? "text-blue-900" : "text-slate-700")}>{servico.name}</span>
                          {isSelected && <Check className="size-4 text-blue-600 shrink-0" />}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                          <span>{servico.duration_minutes} min</span>
                          <span>•</span>
                          <span className={cn(isSelected && "text-blue-700")}>{servico.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PAINEL DE RESUMO */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Estimado</p>
                <p className="text-2xl font-black text-slate-900">{totais.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="bg-white text-slate-600 border-slate-200 shadow-sm px-3 py-1 text-sm h-9">
                  <Scissors className="size-4 mr-2" /> {selectedServiceIds.length} Itens
                </Badge>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 shadow-sm px-3 py-1 text-sm h-9">
                  <Clock className="size-4 mr-2" /> {totais.tempo > 0 ? totais.tempo : 30} min
                </Badge>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-slate-100">
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black h-14 rounded-2xl shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98]" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : (isEditing ? "Salvar Alterações" : "Confirmar Agendamento")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}