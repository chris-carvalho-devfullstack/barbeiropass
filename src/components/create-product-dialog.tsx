"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { productSchema, ProductFormValues } from "@/lib/validations/product";
import { z } from "zod";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, UploadCloud, X, GripVertical, CheckCircle2, Plus, Info } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { CreateCategoryDialog } from "@/components/create-category-dialog"; 

type ProductFormInput = z.input<typeof productSchema>;

type FotoState = {
  id: string;
  file?: File;
  url: string;
  status: "pendente" | "uploading" | "concluido" | "erro";
};

export interface ProductData {
  id: string;
  name: string;
  description?: string | null;
  sku: string;
  barcode?: string | null;
  price: number;
  cost_price: number;
  stock_quantity: number;
  commission_percentage?: number | null; // <-- NOVA PROPRIEDADE
  category_id: string;
  is_active: boolean;
  images?: string[] | null;
}

interface ProductFormDialogProps {
  product?: ProductData;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export function ProductFormDialog({ product, open: controlledOpen, onOpenChange, trigger }: ProductFormDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;
  const setOpen = onOpenChange !== undefined ? onOpenChange : setUncontrolledOpen;
  
  const isEditing = !!product;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [fotos, setFotos] = useState<FotoState[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  
  const router = useRouter();

  const form = useForm<ProductFormInput, unknown, ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name || "",
      description: product?.description || "",
      sku: product?.sku || "",
      barcode: product?.barcode || "",
      price: product?.price ?? "", 
      cost_price: product?.cost_price ?? "",
      commission_percentage: product?.commission_percentage ?? "", // <-- VALOR DEFAULT DA COMISSÃO
      stock_quantity: product?.stock_quantity ?? 0, // <-- Forçando 0 no cadastro
      category_id: product?.category_id || "", 
      is_active: product?.is_active ?? true,
      images: product?.images || [],
    },
  });

  useEffect(() => {
    if (open && product) {
      form.reset({
        name: product.name,
        description: product.description || "",
        sku: product.sku,
        barcode: product.barcode || "",
        price: product.price ?? "",
        cost_price: product.cost_price ?? "",
        commission_percentage: product.commission_percentage ?? "", // <-- RESET DA COMISSÃO
        stock_quantity: product.stock_quantity ?? 0,
        category_id: product.category_id,
        is_active: product.is_active,
        images: product.images || [],
      });
      
      if (product.images && Array.isArray(product.images)) {
        setFotos(
          product.images.map((url: string) => ({
            id: Math.random().toString(36).substring(7),
            url,
            status: "concluido"
          }))
        );
      } else {
        setFotos([]);
      }
    }
  }, [open, product, form]);

  const fetchCategories = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("product_categories").select("id, name").order("name");
    if (data) setCategories(data);
  }, []);

  useEffect(() => {
    if (open) fetchCategories();
  }, [open, fetchCategories]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const novasFotos = Array.from(e.target.files);

    if (fotos.length + novasFotos.length > 5) {
      toast.error("O limite máximo é de 5 fotos por produto.");
      return;
    }

    const validFotos: FotoState[] = [];
    
    novasFotos.forEach((file) => {
      const validTypes = ["image/png", "image/jpeg", "image/jpg"];
      if (!validTypes.includes(file.type)) {
        toast.error(`O formato do arquivo ${file.name} não é suportado. Use apenas PNG ou JPG.`);
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`A imagem ${file.name} excede o limite de 10MB.`);
        return;
      } 
      
      validFotos.push({
        id: Math.random().toString(36).substring(7),
        file,
        url: URL.createObjectURL(file),
        status: "pendente",
      });
    });

    setFotos((prev) => [...prev, ...validFotos]);
    e.target.value = "";
  };

  const removerFoto = (indexToRemove: number) => {
    setFotos(fotos.filter((_, index) => index !== indexToRemove));
  };

  const handleDragStart = (index: number) => setDraggedIndex(index);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (index: number) => {
    if (draggedIndex === null) return;
    const novaOrdem = [...fotos];
    const itemArrastado = novaOrdem.splice(draggedIndex, 1)[0];
    novaOrdem.splice(index, 0, itemArrastado);
    setFotos(novaOrdem);
    setDraggedIndex(null);
  };

  const preventInvalidNumberKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['-', '+', 'e', 'E'].includes(e.key)) {
      e.preventDefault();
    }
  };

  async function onSubmit(data: ProductFormValues) {
    setIsSubmitting(true);
    const toastId = toast.loading(isEditing ? "Atualizando produto..." : "Preparando cadastro do produto...");

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: member } = await supabase
        .from("barbershop_members")
        .select("barbershop_id")
        .eq("profile_id", user.id)
        .single();

      if (!member) throw new Error("Barbearia não encontrada");

      const urlsFinais: string[] = [];

      if (fotos.length > 0) {
        toast.loading("Enviando fotografias...", { id: toastId });

        for (let i = 0; i < fotos.length; i++) {
          const foto = fotos[i];

          if (foto.status === "concluido" && !foto.file) {
            urlsFinais.push(foto.url);
            continue;
          }

          if (!foto.file) continue;

          setFotos((prev) => prev.map((f, idx) => (idx === i ? { ...f, status: "uploading" } : f)));

          const extensao = foto.file.name.split(".").pop();
          const nomeArquivoSeguro = `${Date.now()}-${i}.${extensao}`;
          const filePath = `${member.barbershop_id}/produtos/${nomeArquivoSeguro}`;

          const { error: uploadError } = await supabase.storage
            .from("product-images")
            .upload(filePath, foto.file, {
              contentType: foto.file.type,
              upsert: true
            });

          if (uploadError) {
            setFotos((prev) => prev.map((f, idx) => (idx === i ? { ...f, status: "erro" } : f)));
            throw new Error(`Erro no upload: ${uploadError.message}`);
          }

          const { data: urlData } = supabase.storage
            .from("product-images")
            .getPublicUrl(filePath);

          urlsFinais.push(urlData.publicUrl);

          setFotos((prev) => prev.map((f, idx) => (idx === i ? { ...f, status: "concluido" } : f)));
        }
      }

      toast.loading("Salvando detalhes no banco de dados...", { id: toastId });

      data.images = urlsFinais;

      const method = isEditing ? "PUT" : "POST";
      const payload = isEditing ? { id: product?.id, ...data } : data;

      const res = await fetch("/api/produtos/manage", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Erro ao salvar produto");
      }

      toast.success(isEditing ? "Produto atualizado com sucesso!" : "Produto cadastrado com sucesso!", { id: toastId });
      setOpen(false);
      
      if (!isEditing) {
        form.reset();
        setFotos([]);
      }
      
      router.refresh();
    } catch (error: unknown) {
      console.error("Erro no formulário de produtos:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro ao salvar produto.";
      toast.error(`Falha: ${errorMessage}`, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isSubmitting && !isEditing) {
      form.reset();
      setFotos([]);
    }
    setOpen(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2">
            <Plus className="size-4" /> Novo Produto
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>{isEditing ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Atualize as informações, fotos e valores do produto." : "Cadastre um novo item e defina a precificação."}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="px-6 pb-6">
            <Tabs defaultValue="geral" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="geral">Geral</TabsTrigger>
                <TabsTrigger value="valores">Valores & Estoque</TabsTrigger>
                <TabsTrigger value="midia">Mídia</TabsTrigger>
              </TabsList>
              
              <div className="h-90 overflow-y-auto pr-2 custom-scrollbar pb-2">
                
                {/* --- ABA GERAL --- */}
                <TabsContent value="geral" className="space-y-4 mt-0">
                  <FormField name="name" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Produto <span className="text-red-500">*</span></FormLabel>
                      <FormControl><Input placeholder="Ex: Pomada Efeito Matte 150g" disabled={isSubmitting} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField name="description" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição (Opcional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Ex: Pomada modeladora de alta fixação..."
                          className="resize-none h-20"
                          disabled={isSubmitting}
                          maxLength={300}
                          {...field}
                          value={field.value || ""} 
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-[10px] text-muted-foreground text-right mt-1">
                        {field.value?.length || 0} / 300
                      </p>
                    </FormItem>
                  )} />
                  
                  <FormField name="category_id" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria <span className="text-red-500">*</span></FormLabel>
                      <div className="flex items-center gap-2">
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value} disabled={isSubmitting}>
                          <FormControl>
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Selecione uma categoria" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories.length === 0 ? (
                              <div className="p-2 text-sm text-muted-foreground text-center">Nenhuma categoria encontrada.</div>
                            ) : (
                              categories.map(cat => (
                                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <CreateCategoryDialog onCategoryCreated={fetchCategories} />
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField name="sku" control={form.control} render={({ field }) => (
                      <FormItem>
                        <FormLabel>SKU <span className="text-red-500">*</span></FormLabel>
                        <FormControl><Input placeholder="POM-MATTE-01" disabled={isSubmitting} {...field} value={field.value || ""} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField name="barcode" control={form.control} render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código de Barras</FormLabel>
                        <FormControl><Input placeholder="7890000000000" disabled={isSubmitting} {...field} value={field.value || ""} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <FormField name="is_active" control={form.control} render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20">
                      <div className="space-y-0.5">
                        <FormLabel>Produto Ativo</FormLabel>
                        <FormDescription>Deixe marcado para aparecer no PDV.</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSubmitting} />
                      </FormControl>
                    </FormItem>
                  )} />
                </TabsContent>

                {/* --- ABA VALORES E ESTOQUE --- */}
                <TabsContent value="valores" className="space-y-6 mt-0">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField name="cost_price" control={form.control} render={({ field }) => (
                      <FormItem>
                        <FormLabel>Custo (R$)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            min="0"
                            placeholder="0.00" 
                            disabled={isSubmitting}
                            onKeyDown={preventInvalidNumberKeys}
                            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            {...field} 
                            value={(field.value ?? "") as string | number}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField name="price" control={form.control} render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preço de Venda (R$) <span className="text-red-500">*</span></FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            min="0"
                            placeholder="0.00" 
                            disabled={isSubmitting}
                            onKeyDown={preventInvalidNumberKeys}
                            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            {...field} 
                            value={(field.value ?? "") as string | number}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* CAMPO DE COMISSÃO DO PRODUTO */}
                    <FormField name="commission_percentage" control={form.control} render={({ field }) => (
                      <FormItem>
                        <FormLabel>Comissão por Venda (%)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.1" 
                            min="0"
                            max="100"
                            placeholder="Ex: 10" 
                            disabled={isSubmitting}
                            onKeyDown={preventInvalidNumberKeys}
                            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            {...field} 
                            value={(field.value ?? "") as string | number}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    {/* CAMPO DE ESTOQUE (BLOQUEADO) */}
                    <FormField name="stock_quantity" control={form.control} render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estoque {isEditing ? "Atual" : "Inicial"}</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0"
                            className="bg-muted cursor-not-allowed text-muted-foreground font-bold"
                            disabled={true} // <-- SEMPRE BLOQUEADO PARA FORÇAR O EVENT SOURCING
                            {...field} 
                            value={(field.value ?? 0) as string | number}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  
                  {/* ALERTA DE RASTREABILIDADE */}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-3 items-start">
                    <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-900">Estoque rastreável e seguro</p>
                      <p className="text-xs text-amber-700 mt-1">Para garantir auditoria total contra perdas, o estoque só pode ser adicionado/removido na tela de <span className="font-bold">Ações &gt; Ajustar Estoque</span> após o cadastro.</p>
                    </div>
                  </div>
                </TabsContent>

                {/* --- ABA MÍDIA --- */}
                <TabsContent value="midia" className="space-y-4 mt-0">
                  <div className="flex justify-between items-center mb-1">
                    <FormLabel>Fotografias (Até 5 fotos, max 10MB)</FormLabel>
                    <span className="text-xs text-zinc-500">{fotos.length}/5</span>
                  </div>

                  <div className="flex items-center justify-center w-full">
                    <label
                      className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-lg transition-colors ${fotos.length >= 5 || isSubmitting ? "bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 cursor-not-allowed opacity-60" : "bg-zinc-50 dark:bg-zinc-900/50 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"}`}
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <UploadCloud className="size-6 text-zinc-400 mb-2" />
                        <p className="text-sm text-zinc-500 text-center px-4">
                          Clique ou arraste as fotos aqui
                          <br />
                          <span className="text-xs">Apenas PNG e JPG</span>
                        </p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        multiple
                        accept="image/png, image/jpeg, image/jpg"
                        onChange={handleFileSelect}
                        disabled={fotos.length >= 5 || isSubmitting}
                      />
                    </label>
                  </div>

                  {fotos.length > 0 && (
                    <div className="space-y-2 mt-4">
                      {fotos.map((foto, index) => (
                        <div
                          key={foto.id}
                          draggable={!isSubmitting}
                          onDragStart={() => handleDragStart(index)}
                          onDragOver={handleDragOver}
                          onDrop={() => handleDrop(index)}
                          className={`flex items-center justify-between p-2 bg-white dark:bg-zinc-950 border dark:border-zinc-800 rounded-md shadow-sm transition-all ${isSubmitting ? "opacity-80" : "cursor-move hover:border-zinc-400 dark:hover:border-zinc-600"}`}
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <GripVertical className="size-10 text-zinc-400 shrink-0" />
                            <Image
                              src={foto.url}
                              alt="Preview"
                              width={40}
                              height={40}
                              className="size-10 object-cover rounded-md shrink-0 bg-muted"
                              unoptimized
                            />
                            <span className="text-sm truncate w-24 sm:w-44 text-zinc-700 dark:text-zinc-300">
                              {foto.file ? foto.file.name : `Imagem salva ${index + 1}`}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            {foto.status === "uploading" && (
                              <span className="text-xs text-blue-500 flex items-center gap-1">
                                <Loader2 className="size-3 animate-spin" /> Enviando
                              </span>
                            )}
                            {foto.status === "concluido" && (
                              <span className="text-xs text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 className="size-3" /> OK
                              </span>
                            )}
                            {foto.status === "erro" && (
                              <span className="text-xs text-red-500 flex items-center gap-1">
                                <X className="size-3" /> Erro
                              </span>
                            )}
                            {foto.status === "pendente" && (
                              <span className="text-xs text-zinc-400">Pendente</span>
                            )}

                            {!isSubmitting && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                onClick={() => removerFoto(index)}
                              >
                                <X className="size-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </div>

              <DialogFooter className="pt-4 mt-4 border-t dark:border-zinc-800">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {isEditing ? "Atualizando..." : "Salvando..."}
                    </>
                  ) : (
                    isEditing ? "Salvar Alterações" : "Salvar Produto"
                  )}
                </Button>
              </DialogFooter>
            </Tabs>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export { ProductFormDialog as CreateProductDialog };