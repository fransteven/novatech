import { z } from "zod";

export const warrantyLookupSchema = z.object({
  serial: z.string().trim().min(3, "Ingresa un serial/IMEI válido"),
});

export const createClaimSchema = z.object({
  productItemId: z.string().uuid("Unidad inválida"),
  reportedSerial: z.string().trim().optional(),
  issue: z.string().trim().min(3, "Describe la falla reportada"),
});

export const updateClaimStatusSchema = z.object({
  claimId: z.string().uuid(),
  status: z.enum([
    "abierto",
    "en_reparacion",
    "reparado",
    "reemplazado",
    "rechazado",
  ]),
  resolutionNotes: z.string().trim().optional(),
});

export const adjustWarrantySchema = z.object({
  productItemId: z.string().uuid(),
  startDate: z.coerce.date(),
  warrantyMonths: z.coerce
    .number()
    .int()
    .min(0, "Los meses de garantía no pueden ser negativos"),
  notes: z.string().trim().optional(),
});

export type WarrantyLookupInput = z.infer<typeof warrantyLookupSchema>;
export type CreateClaimInput = z.infer<typeof createClaimSchema>;
export type UpdateClaimStatusInput = z.infer<typeof updateClaimStatusSchema>;
export type AdjustWarrantyInput = z.infer<typeof adjustWarrantySchema>;
