import { z } from "zod";

export const createExpenseCategorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

export type CreateExpenseCategoryInput = z.infer<
  typeof createExpenseCategorySchema
>;

export const createExpenseSchema = z.object({
  amount: z.coerce.number().positive("Amount must be positive"),
  description: z.string().min(1, "Description is required"),
  categoryId: z.string().uuid("Invalid category ID"),
  paymentMethod: z.enum(["cash", "transfer", "card"]).default("cash"),
  date: z.date().optional(),
  relatedProductItemId: z.string().uuid().optional().nullable(),
  accountId: z.string().uuid("ID de cuenta inválido").optional(),
  referenceCode: z.string().optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
