// src/components/create-appointment-dialog.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, CalendarClock, Check, ChevronsUpDown, Scissors, Clock } from "lucide-react";
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

const formSchema = z.object({
  client_name: z.string().min(3, "Nome muito curto"),
  client_phone: z.string().optional(),
  scheduled_at: z.string().min(10, "Data e hora são obrigatórios"),
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

// Utilitário para traduzir o cargo no visual
const traduzirCargo = (role: string) => {
  const cargos: Record<string, string> = {
    barber: 'Barbeiro',
    manager: 'Gerente',
    owner: 'Dono',
  };
  return cargos[role] || role;
};

export function CreateAppointmentDialog({ onAppointmentCreated }: { onAppointmentCreated: () => void }) {
  const [open, setOpen] = useState(false);
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
      scheduled_at: "", 
      service_ids: [], 
      barber_id: "" 
    },
  });

  useEffect(() => {
    if (open && !options) {
      fetch("/api/agendamentos/opcoes")
        .then(res => res.json())
        .then(res => {
          if (res.data) {
            setOptions(res.data as OptionsData);
            // CORREÇÃO 1: Sempre preenche o valor padrão com o ID do usuário logado, 
            // mesmo que ele seja o dono. Isso garante que o Select não inicie "quebrado".
            form.setValue("barber_id", res.data.currentUserId);
          }
        })
        .catch(err => console.error("Erro ao carregar opções:", err));
    }
  }, [open, options, form]);

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
  
  const totais = useMemo(() => {
    if (!options) return { tempo: 0, preco: 0 };
    return selectedServiceIds.reduce((acc, id) => {
      const s = options.services.find(x => x.id === id);
      return s ? { tempo: acc.tempo + s.duration_minutes, preco: acc.preco + s.price } : acc;
    }, { tempo: 0, preco: 0 });
  }, [selectedServiceIds, options]);

  async function onSubmit(values: AppointmentFormValues) {
    setIsSubmitting(true);
    const toastId = toast.loading("Agendando horário...");

    const tempoCalculado = totais.tempo > 0 ? totais.tempo : 30;

    try {
      const response = await fetch("/api/agendamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: values.client_name,
          client_phone: values.client_phone || null,
          scheduled_at: new Date(values.scheduled_at).toISOString(),
          barber_id: values.barber_id || options?.currentUserId,
          service_ids: values.service_ids,
          duration_minutes: tempoCalculado, 
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Falha ao gravar agendamento.");
      }

      toast.success("Agendamento criado com sucesso!", { id: toastId });
      form.reset();
      setSearchTerm("");
      setSugestoes([]);
      setOpen(false);
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md font-bold transition-all active:scale-95">
          <CalendarClock className="size-4" /> Novo Horário
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md bg-white border-none shadow-2xl rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-slate-900">Agendar Cliente</DialogTitle>
          <DialogDescription className="text-slate-500">
            Configure os serviços e o tempo estimado.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            
            {/* Seletor de Barbeiro */}
            {options?.isManager && (
              <FormField control={form.control} name="barber_id" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-bold text-slate-700">Profissional</FormLabel>
                  {/* CORREÇÃO 2: Substituído defaultValue por value={field.value} para controle total */}
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

            <FormField
              control={form.control}
              name="client_name"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="font-bold text-slate-700">Nome do Cliente</FormLabel>
                  <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "justify-between bg-slate-50 border-slate-200 h-12 text-base rounded-xl",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value || "Selecionar cliente..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 border-slate-200 shadow-xl rounded-xl overflow-hidden bg-white">
                      <Command shouldFilter={false}>
                        <CommandInput 
                          placeholder="Pesquise por nome..." 
                          onValueChange={setSearchTerm}
                          className="h-12"
                        />
                        <CommandList>
                          <CommandEmpty className="p-4 text-sm text-center">
                            <p className="text-slate-500 mb-2">Nenhum cadastro encontrado.</p>
                            <Button 
                              type="button"
                              variant="secondary" 
                              className="w-full text-blue-600 font-bold"
                              onClick={() => {
                                field.onChange(searchTerm);
                                setPopoverOpen(false);
                              }}
                            >
                              Usar &quot;{searchTerm}&quot;
                            </Button>
                          </CommandEmpty>
                          <CommandGroup title="Sugestões do Banco">
                            {sugestoes.map((c) => (
                              <CommandItem
                                key={c.id}
                                value={c.name}
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control} name="client_phone"
                render={({ field }) => (
                  <FormItem><FormLabel className="font-bold text-slate-700">WhatsApp</FormLabel>
                    <FormControl><Input className="bg-slate-50 border-slate-200 h-12 rounded-xl" placeholder="(11) 99999-9999" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control} name="scheduled_at"
                render={({ field }) => (
                  <FormItem><FormLabel className="font-bold text-slate-700">Data e Hora</FormLabel>
                    <FormControl><Input type="datetime-local" className="bg-slate-50 border-slate-200 h-12 rounded-xl" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
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
                {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Confirmar Agendamento"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}