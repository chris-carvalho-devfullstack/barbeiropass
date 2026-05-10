"use client";

import { useEffect } from "react"; // useState removido
import { supabase } from "@/lib/supabase";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  nome: z.string().min(3, "Mínimo 3 caracteres"),
  categoria: z.string().min(1, "Obrigatório"),
  tempo: z.string().min(1, "Obrigatório"),
  preco: z.string().min(1, "Obrigatório"),
});

// Tipagem exata para substituir o "any"
interface Servico {
  id: string;
  nome: string;
  categoria: string;
  preco: string;
  tempo: string;
}

interface UpdateServiceDialogProps {
  servico: Servico | null; // O TypeScript agora sabe exatamente o formato do dado
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onServiceUpdated: () => void;
}

export function UpdateServiceDialog({
  servico,
  open,
  onOpenChange,
  onServiceUpdated,
}: UpdateServiceDialogProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  // Atualiza o form quando o serviço selecionado mudar
  useEffect(() => {
    if (servico) {
      form.reset({
        nome: servico.nome,
        categoria: servico.categoria,
        tempo: servico.tempo,
        preco: servico.preco,
      });
    }
  }, [servico, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!servico) return;

    const toastId = toast.loading("Atualizando serviço...");

    const { error } = await supabase
      .from("servicos")
      .update({
        nome: values.nome,
        categoria: values.categoria,
        tempo: values.tempo,
        preco: values.preco,
      })
      .eq("id", servico.id);

    if (error) {
      toast.error("Erro ao atualizar.", { id: toastId });
      return;
    }

    toast.success("Serviço atualizado!", { id: toastId });
    onOpenChange(false);
    onServiceUpdated();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Serviço</DialogTitle>
          <DialogDescription>
            Altere os dados do serviço abaixo.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="categoria"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Cabelo">Cabelo</SelectItem>
                        <SelectItem value="Barba">Barba</SelectItem>
                        <SelectItem value="Combo">Combo</SelectItem>
                        <SelectItem value="Química">Química</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tempo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tempo (min)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="preco"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preço (R$)</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" className="w-full">
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
