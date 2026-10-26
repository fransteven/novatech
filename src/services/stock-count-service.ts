import { db } from "@/db";
import {
  categories,
  productBarcodes,
  productItems,
  products,
  stockCountLines,
  stockCounts,
} from "@/db/schema";
import { and, asc, desc, eq, inArray, like, sql } from "drizzle-orm";
import { receiveStockLines, type DbExecutor } from "@/services/inventory-service";
import {
  addProductBarcodes,
  findProductByBarcode,
} from "@/services/product-barcode-service";
import { createProduct, generateProductSku } from "@/services/product-service";
import { normalizeBarcode } from "@/lib/barcodes";
import { normalizeSerial } from "@/lib/serials";
import {
  findCountProblems,
  INTERNAL_CODE_PREFIX,
  nextInternalCode,
} from "@/lib/stock-count";
import type { ItemCondition } from "@/lib/validators/inventory-validator";
import type { QuickCreateProductInput } from "@/lib/validators/stock-count-validator";

/**
 * Toma de inventario por escaneo.
 *
 * Un conteo es un borrador por zona/estante: se escanea, se ajustan cantidades
 * y costos, y sólo `applyCount` mete la mercancía al stock (vía
 * `receiveStockLines`, el único punto de entrada de inventario). Todas las
 * mutaciones exigen que el conteo siga en borrador.
 */

// ── Conteos ────────────────────────────────────────────────────────────────

export const createCount = async (name: string, userId: string) => {
  const [count] = await db
    .insert(stockCounts)
    .values({ name, createdBy: userId })
    .returning();
  return count;
};

export const listCounts = async () =>
  await db
    .select({
      id: stockCounts.id,
      name: stockCounts.name,
      status: stockCounts.status,
      createdAt: stockCounts.createdAt,
      appliedAt: stockCounts.appliedAt,
      lines: sql<number>`COUNT(${stockCountLines.id})::int`,
      units: sql<number>`COALESCE(SUM(${stockCountLines.quantity}), 0)::int`,
      value: sql<number>`COALESCE(SUM(${stockCountLines.quantity} * ${stockCountLines.unitCost}), 0)::float`,
    })
    .from(stockCounts)
    .leftJoin(stockCountLines, eq(stockCountLines.countId, stockCounts.id))
    .groupBy(stockCounts.id)
    .orderBy(desc(stockCounts.createdAt));

export const getCountWithLines = async (countId: string) => {
  const [count] = await db
    .select()
    .from(stockCounts)
    .where(eq(stockCounts.id, countId))
    .limit(1);
  if (!count) return null;

  const lines = await db
    .select({
      id: stockCountLines.id,
      productId: stockCountLines.productId,
      condition: stockCountLines.condition,
      quantity: stockCountLines.quantity,
      unitCost: stockCountLines.unitCost,
      serials: stockCountLines.serials,
      updatedAt: stockCountLines.updatedAt,
      productName: products.name,
      productSku: products.sku,
      productPrice: products.price,
      isSerialized: products.isSerialized,
      attributes: products.attributes,
      categoryName: categories.name,
      // Código interno (INT-…) para imprimir etiqueta, si el producto tiene uno.
      internalCode: sql<string | null>`(
        SELECT ${productBarcodes.code} FROM ${productBarcodes}
        WHERE ${productBarcodes.productId} = ${products.id}
          AND ${productBarcodes.kind} = 'internal'
        ORDER BY ${productBarcodes.createdAt} LIMIT 1
      )`,
    })
    .from(stockCountLines)
    .innerJoin(products, eq(stockCountLines.productId, products.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(stockCountLines.countId, countId))
    .orderBy(desc(stockCountLines.updatedAt));

  return { ...count, lines };
};

export type StockCountDetail = NonNullable<
  Awaited<ReturnType<typeof getCountWithLines>>
>;
export type StockCountLineView = StockCountDetail["lines"][number];

const assertDraft = async (executor: DbExecutor, countId: string) => {
  const [count] = await executor
    .select({ status: stockCounts.status })
    .from(stockCounts)
    .where(eq(stockCounts.id, countId))
    .limit(1);
  if (!count) throw new Error("El conteo no existe.");
  if (count.status !== "draft") {
    throw new Error("El conteo ya fue aplicado: no se puede modificar.");
  }
};

/** Borra un conteo en borrador (sus líneas caen en cascada). */
export const deleteDraftCount = async (countId: string) => {
  const [removed] = await db
    .delete(stockCounts)
    .where(and(eq(stockCounts.id, countId), eq(stockCounts.status, "draft")))
    .returning();
  if (!removed) throw new Error("Sólo se pueden borrar conteos en borrador.");
  return removed;
};

// ── Líneas ─────────────────────────────────────────────────────────────────

/** Suma `quantity` unidades (no serializadas) a la línea producto+condición. */
const upsertGenericLine = async (
  executor: DbExecutor,
  countId: string,
  productId: string,
  condition: ItemCondition,
  quantity: number,
  unitCost?: number | null,
) => {
  const [line] = await executor
    .insert(stockCountLines)
    .values({
      countId,
      productId,
      condition,
      quantity,
      unitCost: unitCost == null ? null : unitCost.toString(),
    })
    .onConflictDoUpdate({
      target: [
        stockCountLines.countId,
        stockCountLines.productId,
        stockCountLines.condition,
      ],
      set: {
        quantity: sql`${stockCountLines.quantity} + ${quantity}`,
        // Un costo nuevo reemplaza al anterior; si no se envía, se conserva.
        unitCost: sql`COALESCE(EXCLUDED.unit_cost, ${stockCountLines.unitCost})`,
        updatedAt: new Date(),
      },
    })
    .returning();
  return line;
};

/** Agrega seriales a la línea serializada producto+condición. */
const appendSerials = async (
  executor: DbExecutor,
  countId: string,
  productId: string,
  condition: ItemCondition,
  rawSerials: string[],
  unitCost?: number | null,
) => {
  const serials = [...new Set(rawSerials.map(normalizeSerial).filter(Boolean))];
  if (serials.length === 0) throw new Error("Ingresa el serial de la unidad.");

  // Repetidos dentro de este conteo (cualquier producto/condición).
  const inCount = await executor
    .select({ serials: stockCountLines.serials })
    .from(stockCountLines)
    .where(eq(stockCountLines.countId, countId));
  const counted = new Set(inCount.flatMap((row) => row.serials ?? []));
  const repeated = serials.filter((serial) => counted.has(serial));
  if (repeated.length > 0) {
    throw new Error(`Serial ya contado en este conteo: ${repeated.join(", ")}`);
  }

  // Ya existentes en inventario.
  const existing = await executor
    .select({ serialNumber: productItems.serialNumber })
    .from(productItems)
    .where(
      inArray(sql`UPPER(REPLACE(${productItems.serialNumber}, ' ', ''))`, serials),
    );
  if (existing.length > 0) {
    throw new Error(
      `Serial ya registrado en inventario: ${existing.map((row) => row.serialNumber).join(", ")}`,
    );
  }

  const [line] = await executor
    .insert(stockCountLines)
    .values({
      countId,
      productId,
      condition,
      quantity: serials.length,
      serials,
      unitCost: unitCost == null ? null : unitCost.toString(),
    })
    .onConflictDoUpdate({
      target: [
        stockCountLines.countId,
        stockCountLines.productId,
        stockCountLines.condition,
      ],
      set: {
        serials: sql`COALESCE(${stockCountLines.serials}, ARRAY[]::text[]) || EXCLUDED.serials`,
        quantity: sql`COALESCE(array_length(${stockCountLines.serials}, 1), 0) + EXCLUDED.quantity`,
        unitCost: sql`COALESCE(EXCLUDED.unit_cost, ${stockCountLines.unitCost})`,
        updatedAt: new Date(),
      },
    })
    .returning();
  return line;
};

/** Producto por código escaneado: código asociado (UPC/serial/interno) o SKU. */
export const resolveScannedProduct = async (
  rawCode: string,
  executor: DbExecutor = db,
) => {
  const code = normalizeBarcode(rawCode);
  if (!code) return null;

  const byBarcode = await findProductByBarcode(code, executor);
  if (byBarcode) return byBarcode;

  const [bySku] = await executor
    .select()
    .from(products)
    .where(sql`UPPER(${products.sku}) = ${code}`)
    .limit(1);
  return bySku ?? null;
};

export type ScanResult =
  | {
      status: "matched";
      code: string;
      product: { id: string; name: string; isSerialized: boolean };
      /** null si el producto es serializado: falta capturar el serial. */
      quantity: number | null;
    }
  | { status: "unknown"; code: string };

/**
 * Escaneo dentro de un conteo. Producto conocido no serializado → +1.
 * Serializado → no suma: la UI debe pedir el serial (`addSerialToCount`).
 */
export const scanIntoCount = async (
  countId: string,
  rawCode: string,
  condition: ItemCondition,
): Promise<ScanResult> => {
  const code = normalizeBarcode(rawCode);
  if (!code) throw new Error("Código vacío.");

  await assertDraft(db, countId);
  const product = await resolveScannedProduct(code);
  if (!product) return { status: "unknown", code };

  const summary = {
    id: product.id,
    name: product.name,
    isSerialized: product.isSerialized,
  };
  if (product.isSerialized) {
    return { status: "matched", code, product: summary, quantity: null };
  }

  const line = await upsertGenericLine(db, countId, product.id, condition, 1);
  return { status: "matched", code, product: summary, quantity: line.quantity };
};

/** Agrega un producto existente (búsqueda manual) con N unidades. */
export const addProductToCount = async (input: {
  countId: string;
  productId: string;
  condition: ItemCondition;
  quantity: number;
  unitCost?: number | null;
}) => {
  await assertDraft(db, input.countId);
  const [product] = await db
    .select({ isSerialized: products.isSerialized })
    .from(products)
    .where(eq(products.id, input.productId))
    .limit(1);
  if (!product) throw new Error("Producto no encontrado.");
  if (product.isSerialized) {
    throw new Error("Producto serializado: agrega cada unidad con su serial.");
  }
  return await upsertGenericLine(
    db,
    input.countId,
    input.productId,
    input.condition,
    input.quantity,
    input.unitCost,
  );
};

export const addSerialToCount = async (input: {
  countId: string;
  productId: string;
  condition: ItemCondition;
  serial: string;
  unitCost?: number | null;
}) =>
  await db.transaction(async (tx) => {
    await assertDraft(tx, input.countId);
    return await appendSerials(
      tx,
      input.countId,
      input.productId,
      input.condition,
      [input.serial],
      input.unitCost,
    );
  });

const getLineForUpdate = async (executor: DbExecutor, lineId: string) => {
  const [line] = await executor
    .select({
      id: stockCountLines.id,
      countId: stockCountLines.countId,
      serials: stockCountLines.serials,
      isSerialized: products.isSerialized,
    })
    .from(stockCountLines)
    .innerJoin(products, eq(stockCountLines.productId, products.id))
    .where(eq(stockCountLines.id, lineId))
    .limit(1);
  if (!line) throw new Error("La línea no existe.");
  await assertDraft(executor, line.countId);
  return line;
};

/** Cambia cantidad (sólo no serializados) y/o costo unitario de una línea. */
export const updateCountLine = async (input: {
  lineId: string;
  quantity?: number;
  unitCost?: number | null;
}) => {
  const line = await getLineForUpdate(db, input.lineId);
  if (input.quantity !== undefined && line.isSerialized) {
    throw new Error("En serializados la cantidad es el número de seriales.");
  }

  const [updated] = await db
    .update(stockCountLines)
    .set({
      ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
      ...(input.unitCost !== undefined
        ? { unitCost: input.unitCost === null ? null : input.unitCost.toString() }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(stockCountLines.id, input.lineId))
    .returning();
  return updated;
};

/** Quita un serial; si la línea queda vacía, se elimina. */
export const removeSerialFromLine = async (lineId: string, serial: string) => {
  const line = await getLineForUpdate(db, lineId);
  const remaining = (line.serials ?? []).filter((s) => s !== serial);
  if (remaining.length === 0) {
    await db.delete(stockCountLines).where(eq(stockCountLines.id, lineId));
    return null;
  }
  const [updated] = await db
    .update(stockCountLines)
    .set({ serials: remaining, quantity: remaining.length, updatedAt: new Date() })
    .where(eq(stockCountLines.id, lineId))
    .returning();
  return updated;
};

export const removeCountLine = async (lineId: string) => {
  await getLineForUpdate(db, lineId);
  await db.delete(stockCountLines).where(eq(stockCountLines.id, lineId));
};

// ── Códigos internos (mercancía sin código de fábrica) ──────────────────────

/**
 * Asigna al producto su código interno INT-XXXXXX (o devuelve el que ya tiene).
 * Un advisory lock serializa el consecutivo entre peticiones concurrentes.
 */
export const assignInternalCode = async (
  executor: DbExecutor,
  productId: string,
): Promise<string> => {
  const [current] = await executor
    .select({ code: productBarcodes.code })
    .from(productBarcodes)
    .where(
      and(
        eq(productBarcodes.productId, productId),
        eq(productBarcodes.kind, "internal"),
      ),
    )
    .limit(1);
  if (current) return current.code;

  await executor.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext('product_barcodes_internal'))`,
  );
  const existing = await executor
    .select({ code: productBarcodes.code })
    .from(productBarcodes)
    .where(like(productBarcodes.code, `${INTERNAL_CODE_PREFIX}%`));

  const code = nextInternalCode(existing.map((row) => row.code));
  await executor
    .insert(productBarcodes)
    .values({ productId, code, kind: "internal" });
  return code;
};

export const assignInternalCodeToProduct = async (productId: string) =>
  await db.transaction((tx) => assignInternalCode(tx, productId));

// ── Alta rápida desde el conteo ─────────────────────────────────────────────

/**
 * Crea el producto, lo vincula al código escaneado (o le asigna un código
 * interno si no trae) y lo agrega al conteo, todo en una transacción.
 */
export const quickCreateProductInCount = async (input: QuickCreateProductInput) =>
  await db.transaction(async (tx) => {
    await assertDraft(tx, input.countId);

    let categoryName = "GEN";
    if (input.categoryId) {
      const [category] = await tx
        .select({ name: categories.name })
        .from(categories)
        .where(eq(categories.id, input.categoryId))
        .limit(1);
      if (!category) throw new Error("Categoría no encontrada.");
      categoryName = category.name;
    }

    const attributes =
      input.attributes && Object.keys(input.attributes).length > 0
        ? input.attributes
        : undefined;

    const product = await createProduct(
      {
        name: input.name,
        description: input.description || undefined,
        categoryId: input.categoryId || undefined,
        price: input.price.toString(),
        isSerialized: input.isSerialized,
        warrantyMonths: input.warrantyMonths,
        attributes,
        sku: generateProductSku(categoryName, input.name, attributes),
      },
      tx,
    );

    const code = input.code
      ? (await addProductBarcodes(tx, product.id, [input.code]), normalizeBarcode(input.code))
      : await assignInternalCode(tx, product.id);

    const line = input.isSerialized
      ? await appendSerials(
          tx,
          input.countId,
          product.id,
          input.condition,
          input.serials ?? [],
          input.unitCost,
        )
      : await upsertGenericLine(
          tx,
          input.countId,
          product.id,
          input.condition,
          input.quantity,
          input.unitCost,
        );

    return { product, code, line };
  });

// ── Aplicar ────────────────────────────────────────────────────────────────

/**
 * Mete el conteo al inventario. Idempotente: el UPDATE condicionado a
 * status='draft' hace que una segunda llamada (doble clic, reintento) falle sin
 * duplicar stock.
 */
export const applyCount = async (countId: string) =>
  await db.transaction(async (tx) => {
    const [count] = await tx
      .update(stockCounts)
      .set({ status: "applied", appliedAt: new Date() })
      .where(and(eq(stockCounts.id, countId), eq(stockCounts.status, "draft")))
      .returning();
    if (!count) throw new Error("El conteo no existe o ya fue aplicado.");

    const lines = await tx
      .select({
        productId: stockCountLines.productId,
        productName: products.name,
        isSerialized: products.isSerialized,
        condition: stockCountLines.condition,
        quantity: stockCountLines.quantity,
        unitCost: stockCountLines.unitCost,
        serials: stockCountLines.serials,
      })
      .from(stockCountLines)
      .innerJoin(products, eq(stockCountLines.productId, products.id))
      .where(eq(stockCountLines.countId, countId))
      .orderBy(asc(stockCountLines.createdAt));

    const problems = findCountProblems(lines);
    if (problems.length > 0) throw new Error(problems.join(" "));

    const received = await receiveStockLines(
      tx,
      lines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        unitCost: Number(line.unitCost),
        serials: line.isSerialized ? (line.serials ?? []) : undefined,
        condition: line.condition as ItemCondition,
        reason: `Conteo: ${count.name}`,
      })),
    );

    return {
      count,
      lines: received.length,
      units: received.reduce((sum, line) => sum + line.quantity, 0),
    };
  });
