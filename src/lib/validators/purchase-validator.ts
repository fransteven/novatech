import { z } from "zod";

const purchaseDetailSchema = z.object({
  productId: z.string().min(1, "Producto requerido"),
  isSerialized: z.boolean(),
  quantity: z.coerce.number().min(1, "Cantidad debe ser mayor a 0"),
  unitCost: z.coerce.number().min(0, "Costo debe ser 0 o mayor"),
  serialNumbers: z.array(z.string()).optional(),
  conditionDetails: z.any().optional(),
  notes: z.string().optional(),
}).refine((data) => {
  if (data.isSerialized) {
    return data.serialNumbers && data.serialNumbers.length === data.quantity;
  }
  return true;
}, {
  message: "Debe proveer un serial para cada unidad de producto serializado.",
  path: ["serialNumbers"],
});

export const createPurchaseSchema = z.object({
  providerId: z.string().min(1, "Proveedor requerido"),
  accountId: z.string().min(1, "Cuenta de caja requerida"),
  paymentMethod: z.string().min(1, "Método de pago requerido"),
  referenceCode: z.string().optional(),
  notes: z.string().optional(),
  invoiceNumber: z.string().optional(),
  subtotalAmount: z.coerce.number().min(0, "Subtotal debe ser mayor o igual a 0"),
  totalAmount: z.coerce.number().min(0, "Total debe ser mayor o igual a 0"),
  details: z.array(purchaseDetailSchema).min(1, "Debe agregar al menos un producto"),
});

export type CreatePurchaseSchema = z.infer<typeof createPurchaseSchema>;
