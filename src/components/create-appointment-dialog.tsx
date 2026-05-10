"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { CalendarPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const formSchema = z.object({
  cliente_id: z.string().min(1, "Selecione o cliente"),
  servico_id: z.string().min(1, "Selecione o serviço"),
  data_hora: z.string().min(1, "Informe a data e hora"),
});

interface CreateAppointmentProps {
  onAppointmentCreated: () => void;
}

export function CreateAppointmentDialog({
  onAppointmentCreated,
}: CreateAppointmentProps) {
  const [open, setOpen] = useState(false);
  const [clientes, setClientes] = useState<any[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { cliente_id: "", servico_id: "", data_hora: "" },
  });

  // Busca os clientes e serviços quando o modal abrir
  useEffect(() => {
    if (open) {
      supabase
        .from("clientes")
        .select("id, nome")
        .order("nome")
        .then(({ data }) => setClientes(data || []));
      supabase
        .from("servicos")
        .select("id, nome, preco")
        .eq("status", "Ativo")
        .order("nome")
        .then(({ data }) => setServicos(data || []));
    }
  }, [open]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const toastId = toast.loading("Salvando agendamento...");

    const { error } = await supabase.from("agendamentos").insert([
      {
        cliente_id: values.cliente_id,
        servico_id: values.servico_id,
        data_hora: values.data_hora,
        status: "Agendado",
      },
    ]);

    if (error) {
      toast.error("Erro ao agendar.", { id: toastId });
      return;
    }

    toast.success("Horário marcado com sucesso!", { id: toastId });
    form.reset();
    setOpen(false);
    onAppointmentCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <CalendarPlus className="size-4" /> Novo Agendamento
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Agendamento</DialogTitle>
          <DialogDescription>
            Reserve um horário na agenda da barbearia.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 pt-4"
          >
            <FormField
              control={form.control}
              name="cliente_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clientes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="servico_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Serviço</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {servicos.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.nome} (R$ {s.preco})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="data_hora"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data e Hora</FormLabel>
                  <FormControl>
                    {/* Usamos datetime-local para abrir o calendário nativo do celular/PC de forma perfeita */}
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button type="submit" className="w-full">
                Confirmar Agendamento
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
