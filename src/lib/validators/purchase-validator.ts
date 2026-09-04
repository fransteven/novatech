import { z } from "zod";

/**
 * Los inputs `type="number"` mandan `""` cuando el usuario los deja o los deja
 * vacíos, y `Number("")` es 0 — suficiente para que `.min(1)` reviente con un
 * error que el formulario no pinta en ningún lado. Estos dos preprocesadores
 * normalizan el vacío antes de coercionar: uno lo trata como "sin dato" y el
 * otro como cero explícito.
 */
const blankAsUndefined = (value: unknown) =>
  value === "" || value === null ? undefined : value;

const blankAsZero = (value: unknown) =>
  value === "" || value === null || value === undefined ? 0 : value;

/** Número opcional: vacío === no informado (no === 0). */
const optionalNumber = (schema: z.ZodType<number>) =>
  z.preprocess(blankAsUndefined, schema.optional());

/** Número obligatorio donde el vacío significa cero (montos, costos). */
const amountNumber = (schema: z.ZodType<number>) =>
  z.preprocess(blankAsZero, schema);

/**
 * Condición física capturada al recibir un equipo. Se guarda en el JSONB
 * `condition_details` de product_items / purchase_details.
 */
const conditionDetailsSchema = z
  .object({
    batteryHealth: optionalNumber(z.coerce.number().min(1).max(100)),
  })
  .optional()
  .nullable();

/**
 * Línea de compra. `isSerialized` NO viaja en el payload: lo decide el
 * servidor leyendo `products.is_serialized`, así un cliente desactualizado o
 * manipulado no puede meter stock serializado sin seriales (ni al revés).
 */
const purchaseDetailSchema = z.object({
  productId: z.string().uuid("Producto requerido"),
  quantity: z.coerce
    .number()
    .int("La cantidad debe ser un número entero")
    .min(1, "Cantidad debe ser mayor a 0"),
  unitCost: amountNumber(z.coerce.number().min(0, "Costo debe ser 0 o mayor")),
  serialNumbers: z.array(z.string()).optional(),
  conditionDetails: conditionDetailsSchema,
  notes: z.string().optional(),
});

const extraCostSchema = z.object({
  concept: z.string().min(1, "Concepto requerido"),
  amount: amountNumber(
    z.coerce.number().min(0, "El monto no puede ser negativo"),
  ),
  notes: z.string().optional(),
});

export const createPurchaseSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    providerId: z.string().uuid("Proveedor requerido"),
    purchaseDate: z.coerce.date().optional(),
    invoiceNumber: z.string().optional(),
    notes: z.string().optional(),
    details: z
      .array(purchaseDetailSchema)
      .min(1, "Debe agregar al menos un producto"),
    extraCosts: z.array(extraCostSchema).optional(),
    // --- Pago al proveedor ---
    amountPaid: amountNumber(
      z.coerce.number().min(0, "El monto pagado no puede ser negativo"),
    ),
    accountId: z.string().uuid().optional().nullable(),
    paymentMethod: z.string().min(1, "Método de pago requerido"),
    referenceCode: z.string().optional(),
    /** Total calculado en el cliente; el servidor recalcula y lo usa como verificación. */
    expectedTotal: optionalNumber(z.coerce.number().min(0)),
  })
  .superRefine((data, ctx) => {
    // Sin abono no se toca caja; con abono la cuenta es obligatoria.
    if (data.amountPaid > 0 && !data.accountId) {
      ctx.addIssue({
        code: "custom",
        message: "Selecciona la cuenta de caja de la que sale el pago",
        path: ["accountId"],
      });
    }
  });

export type CreatePurchaseSchema = z.infer<typeof createPurchaseSchema>;

export const registerPurchasePaymentSchema = z.object({
  purchaseId: z.string().uuid(),
  amount: z.coerce.number().positive("El abono debe ser mayor a 0"),
  accountId: z.string().uuid("Cuenta de caja requerida"),
  paymentMethod: z.string().min(1, "Método de pago requerido"),
  referenceCode: z.string().optional(),
  notes: z.string().optional(),
  idempotencyKey: z.string().uuid(),
});

export type RegisterPurchasePaymentSchema = z.infer<
  typeof registerPurchasePaymentSchema
>;

export const purchaseFiltersSchema = z.object({
  providerId: z.string().uuid().optional(),
  paymentStatus: z.enum(["paid", "partial", "pending"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  search: z.string().optional(),
});

export type PurchaseFiltersSchema = z.infer<typeof purchaseFiltersSchema>;
