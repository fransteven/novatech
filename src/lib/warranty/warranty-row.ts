import { computeWarrantyExpiry, DEFAULT_WARRANTY_MONTHS } from "./warranty-calc";

/**
 * Estado de cobertura de una entrega.
 * - `vigente` / `vencida`: cobertura normal, calculada desde la fecha de entrega.
 * - `sin_cobertura`: la garantía fue anulada administrativamente
 *   (`warranties.status = 'void'`), independientemente de las fechas.
 */
export type WarrantyStatus = "vigente" | "vencida" | "sin_cobertura";

/**
 * Fila cruda tal como sale del SQL de búsqueda: la línea de entrega
 * (venta o apartado) más, si existe, la garantía materializada que la pisa.
 */
export type RawWarrantyRow = {
  deliveredAt: Date | string;
  productWarrantyMonths: number | null;
  warrantyId: string | null;
  warrantyStartDate: Date | string | null;
  warrantyMonths: number | null;
  warrantyStatus: string | null;
};

export type ResolvedWarranty = {
  startDate: Date;
  warrantyMonths: number;
  expiryDate: Date;
  status: WarrantyStatus;
  daysRemaining: number;
  /** true = derivada al vuelo de la venta/apartado, sin fila en `warranties`. */
  isProvisional: boolean;
};

const toDate = (value: Date | string): Date =>
  value instanceof Date ? value : new Date(value);

/**
 * Única fuente de verdad para resolver la cobertura de una entrega.
 *
 * Precedencia de los meses de garantía:
 *   `warranties.warranty_months` (snapshot al materializar)
 *   → `products.warranty_months` (política del modelo)
 *   → `DEFAULT_WARRANTY_MONTHS` (política de la casa).
 *
 * Precedencia de la fecha de inicio: `warranties.start_date` (entrega real,
 * editable por un admin) → fecha de la venta/apartado. En apartados el equipo
 * se entrega al firmar, no al liquidar, por eso se usa `layaways.created_at`.
 */
export const resolveWarrantyRow = (
  row: RawWarrantyRow,
  now: Date = new Date(),
): ResolvedWarranty => {
  const startDate = row.warrantyStartDate
    ? toDate(row.warrantyStartDate)
    : toDate(row.deliveredAt);

  const warrantyMonths =
    row.warrantyMonths ?? row.productWarrantyMonths ?? DEFAULT_WARRANTY_MONTHS;

  const { expiryDate, status, daysRemaining } = computeWarrantyExpiry(
    startDate,
    warrantyMonths,
    now,
  );

  return {
    startDate,
    warrantyMonths,
    expiryDate,
    // Una garantía anulada no revive por más que las fechas den vigente.
    status: row.warrantyStatus === "void" ? "sin_cobertura" : status,
    daysRemaining,
    isProvisional: row.warrantyId === null,
  };
};

/** Filtro de estado que aplica la UI sobre las filas ya resueltas. */
export type WarrantyStatusFilter = "todas" | "vigente" | "vencida";

export const matchesStatusFilter = (
  status: WarrantyStatus,
  filter: WarrantyStatusFilter,
): boolean => {
  if (filter === "todas") return true;
  // `sin_cobertura` (anulada) cuenta como no vigente al filtrar por "vencida".
  if (filter === "vencida") return status !== "vigente";
  return status === "vigente";
};
