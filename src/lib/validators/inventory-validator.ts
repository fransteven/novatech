import { z } from "zod";

// --- CONDICIÓN DE LA UNIDAD FÍSICA ---
// Vive en product_items.condition, no en el catálogo: el mismo modelo convive
// nuevo y de segunda. Los no serializados (accesorios) no tienen unidad y se
// asumen "new".
export const ITEM_CONDITIONS = ["new", "used", "refurbished"] as const;
export type ItemCondition = (typeof ITEM_CONDITIONS)[number];

export const ITEM_CONDITION_LABELS: Record<ItemCondition, string> = {
  new: "Nuevo",
  used: "Segunda",
  refurbished: "Reacondicionado",
};

// Meses de garantía que la casa ofrece sobre una unidad no nueva.
export const WARRANTY_MONTH_PRESETS = [1, 3, 6] as const;

// Preselección del formulario al elegir condición. Null = hereda la política
// del modelo (products.warrantyMonths) o DEFAULT_WARRANTY_MONTHS.
export const DEFAULT_CONDITION_WARRANTY: Record<ItemCondition, number | null> = {
  new: null,
  used: 1,
  refurbished: 3,
};

export const itemConditionSchema = z.enum(ITEM_CONDITIONS);

export const itemWarrantyMonthsSchema = z
  .union([z.literal(1), z.literal(3), z.literal(6)])
  .nullable()
  .optional();

export const receiveStockSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive("Quantity must be a positive number"),
  unitCost: z.number().min(0, "Unit cost must be a positive number or zero"),
  serials: z.array(z.string().min(1)).optional(),
  // Campos de condición para equipos serializados
  condition: itemConditionSchema.default("new"),
  warrantyMonths: itemWarrantyMonthsSchema,
  batteryHealth: z.number().min(1).max(100).optional(),
  notes: z.string().optional(),
});

// Corrección administrativa de un registro serializado ya existente
// (ej. costo mal ingresado). Solo accesible para rol admin (ver requireAdmin).
export const updateSerialItemSchema = z.object({
  itemId: z.string().uuid(),
  serialNumber: z.string().trim().min(1).nullable(),
  sku: z.string().trim().nullable(),
  status: z.enum(["available", "reserved", "sold", "defective"]),
  unitCost: z.number().min(0, "El costo debe ser positivo o cero"),
  condition: itemConditionSchema,
  warrantyMonths: itemWarrantyMonthsSchema,
  batteryHealth: z.number().min(1).max(100).nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

export type UpdateSerialItemInput = z.infer<typeof updateSerialItemSchema>;

// Schema for the UI Form (client-side)
export const receiveStockFormSchema = z.object({
  productId: z.string().min(1, "Seleccione un producto."),
  unitCost: z.coerce.number().min(0, "El costo debe ser positivo o cero."),
  serials: z.string().min(3, {
    message: "Ingrese al menos un serial.",
  }),
  condition: itemConditionSchema.default("new"),
  warrantyMonths: itemWarrantyMonthsSchema,
  batteryHealth: z.coerce.number().min(1).max(100).optional(),
  notes: z.string().optional(),
});

export type ReceiveStockFormValues = z.infer<typeof receiveStockFormSchema>;

export type InventoryItem = {
  id: string;
  serial: string | null;
  sku: string | null;
  status: string;
  createdAt: Date;
  productName: string | null;
  productId: string | null;
  soldDate: Date | null;
};

export type ReceiveStockInput = z.infer<typeof receiveStockSchema>;

export type InventoryMovement = {
  id: string;
  type: string;
  quantity: number;
  reason: string | null;
  createdAt: Date;
  unitCost: string | null;
  productName: string | null;
  productId: string | null;
  serialNumber: string | null;
  productItemId: string | null;
};
