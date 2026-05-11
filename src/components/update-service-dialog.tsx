"use client";

import { useEffect } from "react"; 
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
import { Textarea } from "@/components/ui/textarea"; // Adicionado caso queira editar descrição
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Form Schema continua o mesmo do seu formulário visual
const formSchema = z.object({
  nome: z.string().min(3, "Mínimo 3 caracteres"),
  descricao: z.string().optional(),
  categoria: z.string().min(1, "Obrigatório"),
  tempo: z.string().min(1, "Obrigatório"),
  preco: z.string().min(1, "Obrigatório"),
});

// Interface alinhada ao banco de dados em Inglês
interface Servico {
  id: string;
  name: string;
  description?: string;
  duration_minutes: number;
  price: number;
  category?: string; 
}

interface UpdateServiceDialogProps {
  servico: Servico | null; 
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
    defaultValues: {
      nome: "",
      descricao: "",
      categoria: "",
      tempo: "",
      preco: "",
    }
  });

  // Atualiza o form preenchendo os dados do banco para o formulário
  useEffect(() => {
    if (servico) {
      form.reset({
        nome: servico.name,
        descricao: servico.description || "",
        categoria: servico.category || "",
        tempo: String(servico.duration_minutes),
        preco: String(servico.price),
      });
    }
  }, [servico, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!servico) return;

    const toastId = toast.loading("A atualizar serviço...");

    const tempoNumerico = parseInt(values.tempo, 10);
    const precoNumerico = parseFloat(values.preco.replace(",", "."));

    // Tabela nova (services) e colunas novas em inglês
    const { error } = await supabase
      .from("services")
      .update({
        name: values.nome,
        description: values.descricao || null,
        category: values.categoria,
        duration_minutes: tempoNumerico,
        price: precoNumerico,
      })
      .eq("id", servico.id);

    if (error) {
      toast.error(`Erro ao atualizar: ${error.message}`, { id: toastId });
      return;
    }

    toast.success("Serviço atualizado com sucesso!", { id: toastId });
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

            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea className="resize-none" {...field} />
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