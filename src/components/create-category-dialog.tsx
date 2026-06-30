"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import { toast } from "sonner";
import { Loader2, PlusCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

// Esquema de validação simples para o nome da categoria
const categorySchema = z.object({
  name: z.string().min(2, "O nome deve ter pelo menos 2 caracteres."),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

interface CreateCategoryDialogProps {
  onCategoryCreated?: () => void;
}

// Função utilitária para gerar o slug a partir do nome
// Ex: "Cervejas Especiais!" -> "cervejas-especiais"
const generateSlug = (text: string) => {
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD") // Remove acentos
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 -]/g, "") // Remove símbolos inválidos
    .replace(/\s+/g, "-") // Substitui espaços por hifens
    .replace(/-+/g, "-") // Remove hifens duplicados
    .trim();
};

export function CreateCategoryDialog({ onCategoryCreated }: CreateCategoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
    },
  });

  async function onSubmit(data: CategoryFormValues) {
    setIsSubmitting(true);
    const toastId = toast.loading("Criando categoria...");

    try {
      const supabase = createClient();
      
      // 1. Pegamos o usuário logado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // 2. Descobrimos qual é a barbearia dele
      const { data: member } = await supabase
        .from("barbershop_members")
        .select("barbershop_id")
        .eq("profile_id", user.id)
        .single();

      if (!member) throw new Error("Barbearia não encontrada");

      // 3. Geramos o slug e o timestamp para garantir que seja único
      const baseSlug = generateSlug(data.name);
      const uniqueSlug = `${baseSlug}-${Date.now().toString().slice(-4)}`;

      // 4. Inserimos no banco com o barbershop_id (Categoria Local)
      const { error } = await supabase
        .from("product_categories")
        .insert({
          name: data.name,
          slug: uniqueSlug,
          barbershop_id: member.barbershop_id, // A MÁGICA DO MULTITENANT ESTÁ AQUI
        });

      if (error) throw error;

      toast.success("Categoria criada com sucesso!", { id: toastId });
      
      setOpen(false);
      form.reset();
      
      // Avisa o componente pai (o select) para recarregar a lista
      if (onCategoryCreated) {
        onCategoryCreated();
      }
      
    } catch (error: unknown) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(`Falha ao criar categoria: ${errorMessage}`, { id: toastId });
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
        <Button type="button" variant="outline" size="icon" className="shrink-0" title="Nova Categoria">
          <PlusCircle className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Nova Categoria</DialogTitle>
          <DialogDescription>
            Crie uma categoria personalizada para organizar os produtos da sua barbearia.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Categoria</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ex: Kits Especiais" 
                      disabled={isSubmitting} 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter className="pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
                  </>
                ) : (
                  "Salvar Categoria"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}