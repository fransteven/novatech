/**
 * Códigos de barras alternativos de un producto (seriales de caja y UPC/EAN).
 * Funciones puras, sin BD, para poder testearlas aisladas.
 */
import { normalizeSerial } from "@/lib/serials";

export type BarcodeKind = "serial" | "upc" | "internal";

export const BARCODE_KIND_LABELS: Record<BarcodeKind, string> = {
  serial: "Serial",
  upc: "UPC/EAN",
  internal: "Interno",
};

/** Misma forma canónica que los seriales: sin espacios y en mayúsculas. */
export const normalizeBarcode = (raw: string): string => normalizeSerial(raw);

/** UPC-A (12), EAN-13 (13) o GTIN-14 (14): sólo dígitos. Lo demás es serial. */
export const inferBarcodeKind = (code: string): BarcodeKind =>
  /^\d{12,14}$/.test(code) ? "upc" : "serial";

/** Normaliza, descarta vacíos y deduplica preservando el orden. */
export const uniqueBarcodes = (codes: string[]): string[] => [
  ...new Set(codes.map(normalizeBarcode).filter(Boolean)),
];
