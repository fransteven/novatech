import { db } from "@/db";
import { productBarcodes, products } from "@/db/schema";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import type { DbExecutor } from "@/services/inventory-service";
import {
  inferBarcodeKind,
  normalizeBarcode,
  uniqueBarcodes,
} from "@/lib/barcodes";

/**
 * Asocia códigos (seriales de caja / UPC) a un producto. Idempotente: un código
 * que ya pertenece al mismo producto se ignora; uno que pertenece a OTRO
 * producto aborta, porque el lector no podría saber cuál vender.
 */
export const addProductBarcodes = async (
  executor: DbExecutor,
  productId: string,
  rawCodes: string[],
) => {
  const codes = uniqueBarcodes(rawCodes);
  if (codes.length === 0) return [];

  const taken = await executor
    .select({ code: productBarcodes.code, productName: products.name })
    .from(productBarcodes)
    .innerJoin(products, eq(productBarcodes.productId, products.id))
    .where(
      and(
        inArray(productBarcodes.code, codes),
        ne(productBarcodes.productId, productId),
      ),
    );

  if (taken.length > 0) {
    const detail = taken
      .map((row) => `${row.code} (${row.productName})`)
      .join(", ");
    throw new Error(`Código(s) ya asignado(s) a otro producto: ${detail}.`);
  }

  return await executor
    .insert(productBarcodes)
    .values(
      codes.map((code) => ({ productId, code, kind: inferBarcodeKind(code) })),
    )
    .onConflictDoNothing({ target: productBarcodes.code })
    .returning();
};

export const listProductBarcodes = async (productId: string) =>
  await db
    .select({
      id: productBarcodes.id,
      code: productBarcodes.code,
      kind: productBarcodes.kind,
      createdAt: productBarcodes.createdAt,
    })
    .from(productBarcodes)
    .where(eq(productBarcodes.productId, productId))
    .orderBy(asc(productBarcodes.kind), asc(productBarcodes.createdAt));

export const removeProductBarcode = async (id: string) => {
  const [removed] = await db
    .delete(productBarcodes)
    .where(eq(productBarcodes.id, id))
    .returning();
  if (!removed) throw new Error("El código no existe.");
  return removed;
};

/** Búsqueda exacta por código escaneado. Devuelve el producto o null. */
export const findProductByBarcode = async (
  rawCode: string,
  executor: DbExecutor = db,
) => {
  const code = normalizeBarcode(rawCode);
  if (!code) return null;

  const [row] = await executor
    .select({ product: products })
    .from(productBarcodes)
    .innerJoin(products, eq(productBarcodes.productId, products.id))
    .where(eq(productBarcodes.code, code))
    .limit(1);

  return row?.product ?? null;
};
