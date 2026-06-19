import { z } from "zod";

// ---------------------------------------------------------------------------
// Crear acreedor
// ---------------------------------------------------------------------------

export const createCreditorSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  contactPhone: z
    .string()
    .regex(/^[\d\s\+\-\(\)]{7,20}$/, "Formato de teléfono inválido")
    .optional()
    .or(z.literal("")),
  notes: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Registrar préstamo (el acreedor presta al negocio)
// ---------------------------------------------------------------------------

export const addLoanSchema = z
  .object({
    creditorId: z.string().uuid("ID de acreedor inválido"),
    amount: z.number().positive("El monto debe ser positivo"),
    accountId: z.string().uuid("Selecciona una cuenta de caja"),
    paymentMethod: z
      .enum(["cash", "transfer", "card", "wallet"])
      .default("cash"),
    compensationType: z
      .enum(["none", "per_transaction", "interest_rate"])
      .default("none"),
    interestRate: z.number().min(0).max(1).optional(), // 0.05 = 5% mensual
    perTransactionFee: z.number().positive().optional(),
    idempotencyKey: z.string().uuid("Clave de idempotencia inválida"),
    occurredAt: z.coerce.date().optional(),
    notes: z.string().optional(),
  })
  .refine(
    (d) =>
      d.compensationType !== "interest_rate" ||
      (d.interestRate !== undefined && d.interestRate > 0),
    {
      message: "Se requiere una tasa de interés mayor a 0",
      path: ["interestRate"],
    }
  )
  .refine(
    (d) =>
      d.compensationType !== "per_transaction" ||
      (d.perTransactionFee !== undefined && d.perTransactionFee > 0),
    {
      message: "Se requiere el monto de comisión por transacción",
      path: ["perTransactionFee"],
    }
  );

// ---------------------------------------------------------------------------
// Registrar pago al acreedor
// ---------------------------------------------------------------------------

export const registerCreditorPaymentSchema = z.object({
  creditorId: z.string().uuid("ID de acreedor inválido"),
  amount: z.number().positive("El monto del pago debe ser positivo"),
  accountId: z.string().uuid("Selecciona una cuenta de caja"),
  paymentMethod: z
    .enum(["cash", "transfer", "card", "wallet"])
    .default("cash"),
  idempotencyKey: z.string().uuid("Clave de idempotencia inválida"),
  occurredAt: z.coerce.date().optional(),
  notes: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Registrar accrual manual (comisión o interés devengado)
// ---------------------------------------------------------------------------

export const recordAccrualSchema = z.object({
  creditorId: z.string().uuid("ID de acreedor inválido"),
  kind: z.enum(["fee", "interest"]),
  amount: z.number().positive("El monto debe ser positivo"),
  idempotencyKey: z.string().uuid("Clave de idempotencia inválida"),
  notes: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CreateCreditorInput = z.infer<typeof createCreditorSchema>;
export type AddLoanInput = z.infer<typeof addLoanSchema>;
export type RegisterCreditorPaymentInput = z.infer<
  typeof registerCreditorPaymentSchema
>;
export type RecordAccrualInput = z.infer<typeof recordAccrualSchema>;
