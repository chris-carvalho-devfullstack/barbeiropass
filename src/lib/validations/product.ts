import * as z from "zod";

export const productSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  sku: z.string().min(1, "SKU é obrigatório"),
  barcode: z.string().optional().nullable(),
  price: z.coerce.number().min(0, "Preço deve ser maior que 0"),
  cost_price: z.coerce.number().min(0, "Custo deve ser maior ou igual a 0"),
  stock_quantity: z.coerce.number().int().min(0, "Quantidade deve ser 0 ou maior"),
  category_id: z.string().uuid("Selecione uma categoria"),
  is_active: z.boolean().default(true),
  images: z.array(z.string()).default([]), // Adicionado para gerenciar as URLs das imagens
});

export type ProductFormValues = z.infer<typeof productSchema>;