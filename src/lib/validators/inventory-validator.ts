import { z } from "zod";

export const receiveStockSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive("Quantity must be a positive number"),
  unitCost: z.number().min(0, "Unit cost must be a positive number or zero"),
  serials: z.array(z.string().min(1)).optional(),
  // Campos de condición para equipos serializados
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
