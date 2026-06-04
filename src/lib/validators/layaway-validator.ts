import { z } from "zod";
import { saleItemSchema } from "./pos-validator";

export const createLayawaySchema = z.object({
  customerId: z.string().uuid("Invalid customer ID"),
  items: z.array(saleItemSchema).min(1, "Debe agregar al menos un producto"),
  totalAmount: z.number().positive("El total debe ser positivo"),
  initialDeposit: z.number().min(0, "El abono inicial no puede ser negativo"),
  expiresAt: z.coerce.date().refine((date) => date > new Date(), {
    message: "La fecha de vencimiento debe ser en el futuro",
  }),
  paymentMethod: z.enum(["cash", "transfer", "card"]).default("cash"),
  accountId: z.string().uuid("ID de cuenta inválido").optional(),
  referenceCode: z.string().optional(),
});

export const addLayawayPaymentSchema = z.object({
  layawayId: z.string().uuid("ID de apartado inválido"),
  amount: z.number().positive("El abono debe ser mayor a cero"),
  paymentMethod: z.enum(["cash", "transfer", "card"]).default("cash"),
  notes: z.string().optional(),
  accountId: z.string().uuid("Selecciona una cuenta"),
  referenceCode: z.string().optional(),
});

export type CreateLayawayInput = z.infer<typeof createLayawaySchema>;
export type AddLayawayPaymentInput = z.infer<typeof addLayawayPaymentSchema>;
