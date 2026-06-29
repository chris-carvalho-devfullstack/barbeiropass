"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { productSchema, ProductFormValues } from "@/lib/validations/product";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// 1. Extraímos o tipo de ENTRADA bruto do Zod para alinhar com os inputs do HTML
type ProductFormInput = z.input<typeof productSchema>;

export function CreateProductDialog() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // 2. A MÁGICA DO TYPESCRIPT: Passamos os 3 genéricos (Input, Contexto, Output)
  // Isso silencia o erro do "Resolver" e "SubmitHandler" perfeitamente sem usar 'any'
  const form = useForm<ProductFormInput, unknown, ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      sku: "",
      barcode: "",
      price: 0,
      cost_price: 0,
      stock_quantity: 0,
      category_id: "", 
      is_active: true,
    },
  });

  // 3. O onSubmit recebe os dados já tipados perfeitamente como números (Output)
  async function onSubmit(data: ProductFormValues) {
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
    } catch (error) {
      // 4. Usamos a variável 'error' em um console.error para o ESLint parar de reclamar
      console.error("Erro no formulário de produtos:", error);
      toast.error("Erro ao salvar produto.");
    } finally {
      setIsLoading(false);
    }
  }

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
                  <FormControl>
                    <Input placeholder="Ex: POM-01" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField name="price" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Preço Venda (R$)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01" 
                      {...field} 
                      // O Input nativo espera strings ou undefined, garantimos isso visualmente
                      value={field.value !== undefined ? String(field.value) : ""} 
                    />
                  </FormControl>
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