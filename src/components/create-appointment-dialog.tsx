// src/components/create-appointment-dialog.tsx
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, CalendarClock, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const formSchema = z.object({
  client_name: z.string().min(3, "Nome muito curto"),
  client_phone: z.string().optional(),
  scheduled_at: z.string().min(10, "Data e hora são obrigatórios"),
});

// Tipagem segura baseada na nossa tabela 'clientes'
interface SugestaoCliente {
  id: string;
  name: string;
  phone: string | null;
}

export function CreateAppointmentDialog({ onAppointmentCreated }: { onAppointmentCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sugestoes, setSugestoes] = useState<SugestaoCliente[]>([]);
  
  const supabase = createClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { client_name: "", client_phone: "", scheduled_at: "" },
  });

  // Busca preditiva de clientes no banco (CORRIGIDO PARA 'clientes' e 'name')
  useEffect(() => {
    const buscarClientes = async () => {
      if (searchTerm.trim().length < 2) {
        setSugestoes([]);
        return;
      }

      // IMPORTANTE: Aqui usamos 'clientes' (tabela) e 'name' (coluna)
      const { data, error } = await supabase
        .from("clientes")
        .select("id, name, phone")
        .ilike("name", `%${searchTerm}%`)
        .limit(5);

      if (!error && data) {
        setSugestoes(data as SugestaoCliente[]);
      } else if (error) {
        console.error("Erro na busca:", error.message);
      }
    };

    const timer = setTimeout(buscarClientes, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, supabase]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    const toastId = toast.loading("Agendando horário...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autorizado");

      const { data: member } = await supabase
        .from("barbershop_members")
        .select("barbershop_id")
        .eq("profile_id", user.id)
        .single();

      // Grava na tabela de agendamentos 'appointments'
      const { error } = await supabase.from("appointments").insert({
        barbershop_id: member?.barbershop_id,
        barber_id: user.id,
        client_name: values.client_name,
        client_phone: values.client_phone || null,
        scheduled_at: new Date(values.scheduled_at).toISOString(),
        status: "scheduled"
      });

      if (error) throw new Error(error.message);

      toast.success("Agendamento criado!", { id: toastId });
      form.reset();
      setOpen(false);
      onAppointmentCreated();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro ao salvar";
      toast.error(`Falha: ${msg}`, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md font-bold transition-all active:scale-95">
          <CalendarClock className="size-4" /> Novo Horário
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md bg-white border-none shadow-2xl rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-slate-900">Agendar Cliente</DialogTitle>
          <DialogDescription className="text-slate-500">
            Busque um cliente cadastrado ou digite um novo.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            
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