import * as z from "zod";

export const productSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  sku: z.string().min(1, "SKU é obrigatório"),
  barcode: z.string().optional().nullable(),
  price: z.coerce.number().min(0, "Preço deve ser maior que 0"),
  cost_price: z.coerce.number().min(0, "Custo deve ser maior ou igual a 0"),
  stock_quantity: z.coerce.number().int().min(0, "Quantidade deve ser 0 ou maior"),
  
  // Nossa nova propriedade sem o invalid_type_error para corrigir o aviso do VS Code
  commission_percentage: z.coerce.number().min(0, "Mínimo é 0").max(100, "Máximo é 100").optional().nullable(),
  
  category_id: z.string().uuid("Selecione uma categoria"),
  is_active: z.boolean().default(true),
  images: z.array(z.string()).default([]), // Adicionado para gerenciar as URLs das imagens
  description: z
    .string()
    .max(300, "A descrição deve ter no máximo 300 caracteres.")
    .transform((val) => val.replace(/[<>]/g, "").trim())
    .optional(),
});

export type ProductFormValues = z.infer<typeof productSchema>;