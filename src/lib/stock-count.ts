/**
 * Toma de inventario: reglas puras (sin BD) para poder testearlas aisladas.
 */

/** Códigos que la app genera para mercancía sin código de fábrica. */
export const INTERNAL_CODE_PREFIX = "INT-";
const INTERNAL_CODE_DIGITS = 6;
const INTERNAL_CODE_RE = /^INT-(\d+)$/;

export const formatInternalCode = (n: number): string =>
  `${INTERNAL_CODE_PREFIX}${String(n).padStart(INTERNAL_CODE_DIGITS, "0")}`;

/** Siguiente consecutivo libre a partir de los códigos internos existentes. */
export const nextInternalCode = (existing: string[]): string => {
  const max = existing.reduce((acc, code) => {
    const match = INTERNAL_CODE_RE.exec(code);
    return match ? Math.max(acc, Number(match[1])) : acc;
  }, 0);
  return formatInternalCode(max + 1);
};

/** UPC-E/EAN-8 (8) a GTIN-14 (14): candidatos a consultar en bases públicas. */
export const isUpcCandidate = (code: string): boolean => /^\d{8,14}$/.test(code);

export interface CountLineForApply {
  productName: string;
  isSerialized: boolean;
  quantity: number;
  unitCost: string | number | null;
  serials: string[] | null;
}

/**
 * Problemas que impiden aplicar el conteo. Vacío = se puede aplicar.
 * - Toda línea necesita costo (lo exige el costo promedio y la utilidad).
 * - Un serializado necesita un serial por unidad.
 */
export const findCountProblems = (lines: CountLineForApply[]): string[] => {
  if (lines.length === 0) return ["El conteo no tiene productos."];

  const problems: string[] = [];
  for (const line of lines) {
    const cost = line.unitCost === null ? NaN : Number(line.unitCost);
    if (!Number.isFinite(cost) || cost < 0) {
      problems.push(`${line.productName}: falta el costo.`);
    }
    if (line.isSerialized) {
      const serials = line.serials ?? [];
      if (serials.length !== line.quantity) {
        problems.push(
          `${line.productName}: ${line.quantity} unidad(es) pero ${serials.length} serial(es).`,
        );
      }
    }
  }
  return problems;
};
