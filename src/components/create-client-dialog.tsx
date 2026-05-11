"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Loader2 } from "lucide-react";
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

// 1. Ajustamos o schema para refletir os dados de um Cliente
const formSchema = z.object({
  nome: z.string().min(3, "O nome deve ter pelo menos 3 caracteres"),
  telefone: z.string().min(10, "Informe um telefone válido com DDD"),
});

// 2. Corrigimos o nome das Props
interface CreateClientDialogProps {
  onClientCreated: () => void | Promise<void>;
}

// 3. CORREÇÃO PRINCIPAL DO DEPLOY: Nome correto da função exportada
export function CreateClientDialog({
  onClientCreated,
}: CreateClientDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      telefone: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    const toastId = toast.loading("A guardar cliente...");

    try {
      // 4. Inserimos na tabela correta ("clientes")
      const { error: dbError } = await supabase.from("clientes").insert([
        {
          nome: values.nome,
          telefone: values.telefone,
          frequencia: "Novo", // Status inicial padrão
        },
      ]);

      if (dbError) {
        throw new Error(dbError.message);
      }

      toast.success("Cliente guardado com sucesso!", { id: toastId });
      form.reset();
      setOpen(false);
      onClientCreated();
    } catch (error) {
      console.error("ERRO:", error);
      // Verifica se o erro possui uma mensagem, senão exibe um texto padrão
      const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido.";
      toast.error(`Falha: ${errorMessage}`, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isSubmitting) {
      form.reset();
    }
    setOpen(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="size-4" /> Novo Cliente
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Cliente</DialogTitle>
          <DialogDescription>
            Preencha os dados abaixo para cadastrar um novo cliente na barbearia.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Carlos Silva" disabled={isSubmitting} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="telefone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>WhatsApp</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: 11999999999" disabled={isSubmitting} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4 mt-4 border-t dark:border-zinc-800">
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                  </>
                ) : (
                  "Salvar Cliente"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}