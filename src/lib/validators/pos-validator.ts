import { z } from "zod";

// Schema for searching products by barcode/SKU
export const searchProductSchema = z.object({
  barcode: z.string().min(1, "Código de barras requerido"),
});

// Schema for a single sale item
export const saleItemSchema = z.object({
  productItemId: z.string().uuid().nullable(),
  productId: z.string().uuid(),
  price: z.number().positive("El precio debe ser positivo"),
  quantity: z.number().int().positive().default(1),
  isSerialized: z.boolean(),
});

export const salePaymentSchema = z.object({
  accountId: z.string().uuid("ID de cuenta inválido"),
  method: z.enum(["cash", "transfer", "card", "wallet"]),
  amount: z.number().positive("El monto del pago debe ser positivo"),
  referenceCode: z.string().optional(),
  notes: z.string().optional(),
});

// Schema for processing a complete sale
export const processSaleSchema = z
  .object({
    items: z.array(saleItemSchema).min(1, "Debe agregar al menos un producto"),
    totalAmount: z.number().positive("El total debe ser positivo"),
    userId: z.string().optional(),
    payments: z.array(salePaymentSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.payments && data.payments.length > 0) {
      const paymentsTotal = data.payments.reduce((sum, p) => sum + p.amount, 0);
      if (Math.abs(paymentsTotal - data.totalAmount) > 0.01) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `La suma de pagos (${paymentsTotal}) no coincide con el total (${data.totalAmount})`,
          path: ["payments"],
        });
      }
    }
  });

export type SearchProductInput = z.infer<typeof searchProductSchema>;
export type SaleItem = z.infer<typeof saleItemSchema>;
export type SalePayment = z.infer<typeof salePaymentSchema>;
export type ProcessSaleInput = z.infer<typeof processSaleSchema>;

// Return type for product search
export type ProductSearchResult = {
  productId: string;
  productItemId: string | null;
  name: string;
  suggestedPrice: string;
  availableQty: number;
  avgUnitCost: number;
  isSerialized: boolean;
  sku: string | null;
};
