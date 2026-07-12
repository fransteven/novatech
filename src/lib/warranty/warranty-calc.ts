import { addMonths } from "date-fns";

// Periodo de garantía aplicado cuando el producto no define uno propio
// (products.warrantyMonths es null).
export const DEFAULT_WARRANTY_MONTHS = 3;

export type WarrantyExpiry = {
  expiryDate: Date;
  status: "vigente" | "vencida";
  daysRemaining: number;
};

/**
 * Calcula el vencimiento de garantía a partir de la fecha real de entrega
 * (no la fecha de venta/liquidación — ver AGENTS.md sobre apartados/créditos
 * entregados antes de liquidarse).
 */
export const computeWarrantyExpiry = (
  startDate: Date,
  warrantyMonths: number,
  now: Date = new Date(),
): WarrantyExpiry => {
  const expiryDate = addMonths(startDate, warrantyMonths);
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / msPerDay);

  return {
    expiryDate,
    status: now <= expiryDate ? "vigente" : "vencida",
    daysRemaining,
  };
};
