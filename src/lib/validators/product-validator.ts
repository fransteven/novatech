import { z } from "zod";

export const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().optional(),
  categoryId: z.string().optional(),
  description: z.string().optional(),
  price: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
    message: "Price must be a valid positive number",
  }),
  isSerialized: z.boolean(),
  warrantyMonths: z
    .number()
    .int()
    .min(0, "Los meses de garantía no pueden ser negativos")
    .optional(),
  attributes: z.record(z.string(), z.any()).optional(),
});

export type ProductInput = z.infer<typeof productSchema>;
