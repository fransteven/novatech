import { z } from "zod";

export const addContributionSchema = z.object({
  shareholderId: z.string().uuid("ID de accionista inválido"),
  amount: z.coerce.number().positive("El aporte debe ser mayor a 0"),
  occurredAt: z.coerce.date().optional(),
  notes: z.string().optional(),
});

export type AddContributionInput = z.infer<typeof addContributionSchema>;

export const createDistributionSchema = z.object({
  periodYear: z
    .number()
    .int()
    .min(2024, "Año debe ser 2024 o posterior")
    .max(2100),
  totalNetProfit: z.coerce
    .number()
    .nonnegative("La utilidad neta no puede ser negativa"),
  notes: z.string().optional(),
});

export type CreateDistributionInput = z.infer<typeof createDistributionSchema>;
