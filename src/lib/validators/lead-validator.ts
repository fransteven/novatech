import { z } from "zod";

// ---------------------------------------------------------------------------
// Crear lead
// ---------------------------------------------------------------------------

export const createLeadSchema = z
  .object({
    prospectName: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    prospectPhone: z
      .string()
      .min(7, "Teléfono inválido")
      .regex(/^[\d\s\+\-\(\)]{7,20}$/, "Formato de teléfono inválido"),
    productDescription: z
      .string()
      .min(3, "Describe el producto (mínimo 3 caracteres)"),
    costPrice: z.number().positive("El costo debe ser positivo"),
    salePrice: z.number().positive("El precio de venta debe ser positivo"),
    interestRate: z.number().min(0.001).max(1).default(0.05),
    termMonths: z.number().int().min(1).max(60).default(12),
    customerId: z.string().uuid("ID de cliente inválido").optional(),
    productId: z.string().uuid("ID de producto inválido").optional(),
    notes: z.string().optional(),
  })
  .refine((data) => data.salePrice >= data.costPrice, {
    message: "El precio de venta debe ser mayor o igual al costo",
    path: ["salePrice"],
  });

// ---------------------------------------------------------------------------
// Cambiar etapa del lead
// ---------------------------------------------------------------------------

export const updateLeadStageSchema = z
  .object({
    leadId: z.string().uuid("ID de lead inválido"),
    stage: z.enum(["nuevo", "contactado", "negociando", "ganado", "perdido"]),
    lostReason: z.string().optional(),
  })
  .refine(
    (data) => data.stage !== "perdido" || !!data.lostReason?.trim(),
    {
      message: "Se requiere el motivo de pérdida",
      path: ["lostReason"],
    }
  );

// ---------------------------------------------------------------------------
// Agregar actividad
// ---------------------------------------------------------------------------

export const addLeadActivitySchema = z.object({
  leadId: z.string().uuid("ID de lead inválido"),
  kind: z.enum(["nota", "cambio_etapa", "contacto", "ia_sugerencia"]),
  content: z.string().min(1, "El contenido no puede estar vacío"),
});

// ---------------------------------------------------------------------------
// Convertir lead a crédito (layaway)
// ---------------------------------------------------------------------------

export const convertLeadToLayawaySchema = z.object({
  leadId: z.string().uuid("ID de lead inválido"),
  customerId: z.string().uuid("Se requiere un cliente registrado para crear el crédito"),
  productId: z.string().uuid("Se requiere el producto de inventario para crear el crédito"),
  expiresAt: z.coerce.date().refine((date) => date > new Date(), {
    message: "La fecha de vencimiento debe ser en el futuro",
  }),
  initialDeposit: z.number().min(0).default(0),
  paymentMethod: z.enum(["cash", "transfer", "card"]).default("cash"),
  accountId: z.string().uuid("Selecciona una cuenta").optional(),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadStageInput = z.infer<typeof updateLeadStageSchema>;
export type AddLeadActivityInput = z.infer<typeof addLeadActivitySchema>;
export type ConvertLeadToLayawayInput = z.infer<typeof convertLeadToLayawaySchema>;
