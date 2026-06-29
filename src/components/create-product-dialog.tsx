"use client";

import { useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form"; // Importação correta
import { zodResolver } from "@hookform/resolvers/zod";
import { productSchema, ProductFormValues } from "@/lib/validations/product";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function CreateProductDialog() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // FIX 1: O generic <ProductFormValues> resolve o erro de atribuição do Resolver
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      sku: "",
      price: 0,
      cost_price: 0,
      stock_quantity: 0,
      is_active: true,
      category_id: "",
    },
  });

  // FIX 2: O tipo SubmitHandler garante que o 'data' seja exatamente o esperado pelo Zod
  const onSubmit: SubmitHandler<ProductFormValues> = async (data) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/produtos/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Erro ao salvar produto");

      toast.success("Produto cadastrado com sucesso!");
      setOpen(false);
      form.reset();
      router.refresh();
    } catch (_error) { // FIX 3: Variável não usada deve começar com _ ou ser removida
      toast.error("Erro ao salvar produto.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Novo Produto</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Novo Produto</DialogTitle>
          <DialogDescription>Adicione um novo item ao estoque da barbearia.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField name="name" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Nome</FormLabel>
                <FormControl><Input placeholder="Ex: Pomada Matte" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField name="sku" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>SKU</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField name="price" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Preço Venda (R$)</FormLabel>
                  {/* .toString() no value ajuda o Input a lidar com números */}
                  <FormControl><Input type="number" {...field} value={field.value.toString()} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Produto
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}