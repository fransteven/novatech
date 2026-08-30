import { z } from "zod";

/**
 * Ancla de una garantía. Un equipo serializado se identifica por su unidad
 * física; un accesorio sin serial (audífonos, cargador) solo existe como línea
 * de una venta o de un apartado. Debe llegar exactamente una vía.
 */
export const warrantyAnchorSchema = z
  .object({
    productItemId: z.string().uuid().optional(),
    saleDetailId: z.string().uuid().optional(),
    layawayDetailId: z.string().uuid().optional(),
  })
  .refine(
    (a) =>
      [a.productItemId, a.saleDetailId, a.layawayDetailId].filter(Boolean)
        .length === 1,
    { message: "Indica exactamente una referencia de la entrega" },
  );

export const warrantySearchSchema = z.object({
  // Texto libre: IMEI/serial (completo o parcial), nombre o cédula o teléfono
  // del cliente, nombre/SKU del producto, o N° (prefijo) de venta/apartado.
  q: z.string().trim().max(120).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  status: z.enum(["todas", "vigente", "vencida"]).default("todas"),
  sourceType: z.enum(["todas", "sale", "layaway"]).default("todas"),
});

export const createClaimSchema = z.object({
  anchor: warrantyAnchorSchema,
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
  anchor: warrantyAnchorSchema,
  startDate: z.coerce.date(),
  warrantyMonths: z.coerce
    .number()
    .int()
    .min(0, "Los meses de garantía no pueden ser negativos"),
  notes: z.string().trim().optional(),
});

export type WarrantyAnchor = z.infer<typeof warrantyAnchorSchema>;
export type WarrantySearchInput = z.infer<typeof warrantySearchSchema>;
export type CreateClaimInput = z.infer<typeof createClaimSchema>;
export type UpdateClaimStatusInput = z.infer<typeof updateClaimStatusSchema>;
export type AdjustWarrantyInput = z.infer<typeof adjustWarrantySchema>;
