"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { categorySchema, CategoryFormValues } from "@/lib/validations/category";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

export function CreateCategoryDialog({ onCategoryCreated }: { onCategoryCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
    },
  });

  async function onSubmit(data: CategoryFormValues) {
    setIsLoading(true);
    try {
      const res = await fetch("/api/categorias/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Erro ao salvar categoria");
      }

      toast.success("Categoria cadastrada com sucesso!");
      setOpen(false);
      form.reset();
      if (onCategoryCreated) onCategoryCreated();
    } catch (error: unknown) {
      console.error("Erro no formulário de categorias:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro ao salvar categoria.";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Plus className="h-4 w-4" /> Nova Categoria
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Categoria</DialogTitle>
          <DialogDescription>Crie categorias para organizar seus produtos no PDV.</DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField name="name" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Nome da Categoria</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Cabelo, Barba, Shampoos" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Categoria
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}