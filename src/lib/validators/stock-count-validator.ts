import { z } from "zod";
import { itemConditionSchema } from "@/lib/validators/inventory-validator";

const money = z.number().min(0, "El valor no puede ser negativo");

export const createCountSchema = z.object({
  name: z.string().trim().min(2, "Ponle un nombre (ej. Estante A – juegos PS5)").max(80),
});

export const scanIntoCountSchema = z.object({
  countId: z.string().uuid(),
  code: z.string().trim().min(3, "Código muy corto").max(64, "Código muy largo"),
  condition: itemConditionSchema,
});

export const addProductToCountSchema = z.object({
  countId: z.string().uuid(),
  productId: z.string().uuid(),
  condition: itemConditionSchema,
  quantity: z.number().int().positive(),
  unitCost: money.nullable().optional(),
});

export const addSerialToCountSchema = z.object({
  countId: z.string().uuid(),
  productId: z.string().uuid(),
  condition: itemConditionSchema,
  serial: z.string().trim().min(3, "Serial muy corto").max(64),
  unitCost: money.nullable().optional(),
});

export const updateCountLineSchema = z.object({
  lineId: z.string().uuid(),
  quantity: z.number().int().positive().optional(),
  unitCost: money.nullable().optional(),
});

export const lineIdSchema = z.object({ lineId: z.string().uuid() });
export const countIdSchema = z.object({ countId: z.string().uuid() });
export const productIdSchema = z.object({ productId: z.string().uuid() });

export const removeSerialSchema = z.object({
  lineId: z.string().uuid(),
  serial: z.string().min(1),
});

export const quickCreateProductSchema = z
  .object({
    countId: z.string().uuid(),
    /** Código escaneado; null = sin código de fábrica → se asigna INT-XXXXXX. */
    code: z.string().trim().min(3).max(64).nullable(),
    categoryId: z.string().uuid().nullable(),
    name: z.string().trim().min(2, "El nombre es obligatorio").max(160),
    description: z.string().trim().max(2000).optional(),
    attributes: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
    price: money,
    unitCost: money,
    isSerialized: z.boolean(),
    warrantyMonths: z.number().int().min(0).optional(),
    condition: itemConditionSchema,
    quantity: z.number().int().positive(),
    serials: z.array(z.string().trim().min(3)).optional(),
  })
  .refine((data) => !data.isSerialized || (data.serials?.length ?? 0) > 0, {
    message: "Un producto serializado necesita al menos un serial.",
    path: ["serials"],
  });

export type QuickCreateProductInput = z.infer<typeof quickCreateProductSchema>;

/** Imagen ya reducida en el cliente (JPEG base64, sin prefijo data:). */
export const productImageSchema = z.object({
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  data: z.string().min(100).max(1_500_000, "La foto es muy pesada"),
});

export const suggestFromImageSchema = z.object({
  images: z.array(productImageSchema).min(1).max(3),
  upcHint: z
    .object({
      name: z.string().optional(),
      brand: z.string().optional(),
      description: z.string().optional(),
    })
    .nullable()
    .optional(),
});
