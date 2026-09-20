import { db } from "@/db";
import { customers, purchases } from "@/db/schema";
import { ilike, or } from "drizzle-orm";

export const FICTITIOUS_CUSTOMER_PREFIX = "FIC-";
export const FICTITIOUS_SERIAL_PREFIX = "SN-FIC-";
export const FICTITIOUS_INVOICE_PREFIX = "FIC-";
export const FICTITIOUS_INVOICE_LEGACY_PREFIX = "FAC-FIC-";

export const FICTITIOUS_CUSTOMER_REGEX = /^FIC-(\d{6})$/i;
export const FICTITIOUS_INVOICE_REGEX = /^(?:FAC-FIC-|FIC-)(\d+)$/i;

/**
 * Formatea un número consecutivo al estándar oficial de documento ficticio de cliente (6 dígitos).
 * Ejemplo: 1 -> "FIC-000001"
 */
export function formatFictitiousCustomerDoc(consecutive: number): string {
  if (consecutive < 1 || !Number.isInteger(consecutive)) {
    throw new Error("El consecutivo debe ser un entero positivo mayor o igual a 1.");
  }
  return `${FICTITIOUS_CUSTOMER_PREFIX}${consecutive.toString().padStart(6, "0")}`;
}

/**
 * Determina si un documento dado corresponde a la estructura de documento ficticio de cliente.
 */
export function isFictitiousCustomerDoc(doc?: string | null): boolean {
  if (!doc) return false;
  return FICTITIOUS_CUSTOMER_REGEX.test(doc.trim().toUpperCase());
}

/**
 * Extrae el consecutivo numérico de un documento ficticio de cliente (ej. "FIC-000025" -> 25).
 * Retorna null si no coincide con el formato.
 */
export function parseFictitiousCustomerDoc(doc?: string | null): number | null {
  if (!doc) return null;
  const match = doc.trim().toUpperCase().match(FICTITIOUS_CUSTOMER_REGEX);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Obtiene el siguiente documento ficticio de cliente disponible en la base de datos,
 * garantizando que no colisione con ninguno existente bajo la restricción UNIQUE.
 */
export async function getNextFictitiousCustomerDoc(database = db): Promise<string> {
  const rows = await database
    .select({ doc: customers.documentId })
    .from(customers)
    .where(ilike(customers.documentId, `${FICTITIOUS_CUSTOMER_PREFIX}%`));

  let maxConsecutive = 0;
  for (const row of rows) {
    const num = parseFictitiousCustomerDoc(row.doc);
    if (num !== null && num > maxConsecutive) {
      maxConsecutive = num;
    }
  }

  return formatFictitiousCustomerDoc(maxConsecutive + 1);
}

/**
 * Formatea un número consecutivo al estándar oficial de factura ficticia (7 dígitos).
 * Ejemplo: 1 -> "FIC-0000001"
 */
export function formatFictitiousInvoiceNumber(consecutive: number, digits = 7): string {
  if (consecutive < 1 || !Number.isInteger(consecutive)) {
    throw new Error("El consecutivo debe ser un entero positivo mayor o igual a 1.");
  }
  return `${FICTITIOUS_INVOICE_PREFIX}${consecutive.toString().padStart(digits, "0")}`;
}

/**
 * Determina si un número de factura dado corresponde a la estructura de factura ficticia o provisional.
 * Soporta el estándar oficial "FIC-XXXXXXX" y el prefijo heredado "FAC-FIC-XXXXXX".
 */
export function isFictitiousInvoiceNumber(invoice?: string | null): boolean {
  if (!invoice) return false;
  return FICTITIOUS_INVOICE_REGEX.test(invoice.trim().toUpperCase());
}

/**
 * Extrae el consecutivo numérico de una factura ficticia (ej. "FIC-0000001" -> 1).
 * Retorna null si no coincide con el formato.
 */
export function parseFictitiousInvoiceNumber(invoice?: string | null): number | null {
  if (!invoice) return null;
  const match = invoice.trim().toUpperCase().match(FICTITIOUS_INVOICE_REGEX);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Obtiene el siguiente número de factura ficticia disponible consultando la base de datos (purchases),
 * garantizando que el agente retorne un número distinto y creciente en cada solicitud para preservar
 * la integridad de los registros.
 */
export async function getNextFictitiousInvoiceNumber(database = db): Promise<string> {
  const rows = await database
    .select({ invoiceNumber: purchases.invoiceNumber })
    .from(purchases)
    .where(
      or(
        ilike(purchases.invoiceNumber, `${FICTITIOUS_INVOICE_PREFIX}%`),
        ilike(purchases.invoiceNumber, `${FICTITIOUS_INVOICE_LEGACY_PREFIX}%`),
      ),
    );

  let maxConsecutive = 0;
  for (const row of rows) {
    const num = parseFictitiousInvoiceNumber(row.invoiceNumber);
    if (num !== null && num > maxConsecutive) {
      maxConsecutive = num;
    }
  }

  return formatFictitiousInvoiceNumber(maxConsecutive + 1);
}
