import { z } from "zod";

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
