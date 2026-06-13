import { z } from "zod";
import { saleItemSchema } from "./pos-validator";

// ---------------------------------------------------------------------------
// Crear apartado (sin_interes o credito)
// ---------------------------------------------------------------------------

export const createLayawaySchema = z
  .object({
    customerId: z.string().uuid("Invalid customer ID"),
    type: z.enum(["sin_interes", "credito"]).default("sin_interes"),
    items: z.array(saleItemSchema).min(1, "Debe agregar al menos un producto"),
    totalAmount: z.number().positive("El total debe ser positivo"),
    initialDeposit: z.number().min(0, "El abono inicial no puede ser negativo").default(0),
    termMonths: z.number().int().min(1).max(60).optional(),
    expiresAt: z.coerce.date().refine((date) => date > new Date(), {
      message: "La fecha de vencimiento debe ser en el futuro",
    }),
    paymentMethod: z.enum(["cash", "transfer", "card"]).default("cash"),
    accountId: z.string().uuid("ID de cuenta inválido").optional(),
    referenceCode: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.type === "credito") {
        return typeof data.termMonths === "number" && data.termMonths >= 1;
      }
      return true;
    },
    { message: "El crédito requiere un plazo en meses (termMonths >= 1)", path: ["termMonths"] }
  )
  .refine(
    (data) => {
      if (data.type === "credito" && data.initialDeposit > 0) {
        return data.initialDeposit < data.totalAmount;
      }
      return true;
    },
    { message: "La cuota inicial debe ser menor al monto total", path: ["initialDeposit"] }
  );

// ---------------------------------------------------------------------------
// Pago sin interés (modalidad sin_interes — lógica original)
// ---------------------------------------------------------------------------

export const addLayawayPaymentSchema = z.object({
  layawayId: z.string().uuid("ID de apartado inválido"),
  amount: z.number().positive("El abono debe ser mayor a cero"),
  paymentMethod: z.enum(["cash", "transfer", "card"]).default("cash"),
  notes: z.string().optional(),
  accountId: z.string().uuid("Selecciona una cuenta"),
  referenceCode: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Pago de crédito (modalidad credito)
// ---------------------------------------------------------------------------

export const registerCreditPaymentSchema = z
  .object({
    layawayId: z.string().uuid("ID de crédito inválido"),
    type: z.enum(["cuota", "solo_interes", "abono_capital"]),
    amount: z.coerce.number().positive("El monto debe ser positivo"),
    scheduleNumber: z.number().int().positive().optional(),
    capitalStrategy: z.enum(["reduce_term", "reduce_installment"]).optional(),
    paymentMethod: z.enum(["cash", "transfer", "card"]).default("cash"),
    accountId: z.string().uuid("Selecciona una cuenta"),
    referenceCode: z.string().optional(),
    notes: z.string().optional(),
    // El cliente genera un UUID por intento de pago — garantiza idempotencia
    idempotencyKey: z.string().uuid("idempotencyKey debe ser un UUID"),
    userId: z.string().optional(),
  })
  .refine(
    (data) =>
      data.type !== "abono_capital" || typeof data.capitalStrategy === "string",
    { message: "Se requiere la estrategia al abonar a capital", path: ["capitalStrategy"] }
  )
  .refine(
    (data) =>
      data.type === "abono_capital" || typeof data.scheduleNumber === "number",
    { message: "Se requiere el número de cuota para este tipo de pago", path: ["scheduleNumber"] }
  );

export type CreateLayawayInput = z.infer<typeof createLayawaySchema>;
export type AddLayawayPaymentInput = z.infer<typeof addLayawayPaymentSchema>;
export type RegisterCreditPaymentInput = z.infer<typeof registerCreditPaymentSchema>;
