import * as z from "zod";

export const categorySchema = z.object({
  name: z.string().min(2, "O nome deve ter pelo menos 2 caracteres"),
});

export type CategoryFormValues = z.infer<typeof categorySchema>;