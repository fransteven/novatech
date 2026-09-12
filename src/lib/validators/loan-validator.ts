import { z } from "zod";

// ---------------------------------------------------------------------------
// Crear préstamo de dinero (desembolso de caja)
// ---------------------------------------------------------------------------

export const createLoanSchema = z.object({
  customerId: z.string().uuid("ID de cliente inválido"),
  principalAmount: z.coerce.number().positive("El monto prestado debe ser positivo"),
  termMonths: z.coerce
    .number()
    .int("El plazo debe ser en meses enteros")
    .min(1, "El plazo debe ser de al menos 1 mes")
    .max(60, "El plazo máximo es de 60 meses"),
  // Tasa mensual: OBLIGATORIA, sin default en DB ni código. Sin tope de usura (hasta 1.0 = 100% mensual).
  interestRate: z.coerce
    .number()
    .gt(0, "La tasa de interés debe ser mayor a cero")
    .max(1, "La tasa mensual no puede superar el 100% (1.0)"),
  accountId: z.string().uuid("Selecciona una cuenta de origen"),
  paymentMethod: z.enum(["cash", "transfer", "card"]).default("cash"),
  originationFee: z.coerce
    .number()
    .min(0, "La comisión de originación no puede ser negativa")
    .optional(),
  collateral: z.string().optional(),
  notes: z.string().optional(),
  firstDueDate: z.coerce.date().refine((date) => date > new Date(), {
    message: "La fecha de la primera cuota debe ser en el futuro",
  }),
  idempotencyKey: z.string().uuid("idempotencyKey debe ser un UUID válido"),
});

// ---------------------------------------------------------------------------
// Registrar pago de préstamo (cuota, solo interés, abono capital, abono cuota)
// ---------------------------------------------------------------------------

export const registerLoanPaymentSchema = z
  .object({
    loanId: z.string().uuid("ID de préstamo inválido"),
    type: z.enum(["cuota", "solo_interes", "abono_capital", "abono_cuota"]),
    amount: z.coerce.number().positive("El monto debe ser positivo"),
    scheduleNumber: z.coerce.number().int().positive().optional(),
    capitalStrategy: z.enum(["reduce_term", "reduce_installment"]).optional(),
    paymentMethod: z.enum(["cash", "transfer", "card"]).default("cash"),
    accountId: z.string().uuid("Selecciona una cuenta"),
    referenceCode: z.string().optional(),
    notes: z.string().optional(),
    idempotencyKey: z.string().uuid("idempotencyKey debe ser un UUID"),
    userId: z.string().optional(),
  })
  .refine(
    (data) =>
      data.type !== "abono_capital" || typeof data.capitalStrategy === "string",
    {
      message: "Se requiere la estrategia al abonar a capital",
      path: ["capitalStrategy"],
    }
  )
  .refine(
    (data) =>
      data.type === "abono_capital" || typeof data.scheduleNumber === "number",
    {
      message: "Se requiere el número de cuota para este tipo de pago",
      path: ["scheduleNumber"],
    }
  );

// ---------------------------------------------------------------------------
// Castigo de cartera (incobrable / defaulted)
// ---------------------------------------------------------------------------

export const writeOffLoanSchema = z.object({
  loanId: z.string().uuid("ID de préstamo inválido"),
  reason: z.string().min(10, "El motivo debe tener al menos 10 caracteres"),
});

export type CreateLoanInput = z.infer<typeof createLoanSchema>;
export type RegisterLoanPaymentInput = z.infer<typeof registerLoanPaymentSchema>;
export type WriteOffLoanInput = z.infer<typeof writeOffLoanSchema>;
