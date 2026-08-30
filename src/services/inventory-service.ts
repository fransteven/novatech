import { db } from "@/db";
import {
  products,
  productItems,
  inventoryMovements,
  sales,
  saleDetails,
} from "@/db/schema";
import { eq, desc, sql, or, ilike, inArray, and } from "drizzle-orm";
import {
  ReceiveStockInput,
  UpdateSerialItemInput,
} from "@/lib/validators/inventory-validator";
import { findDuplicateSerials, normalizeSerial } from "@/lib/serials";

/** El cliente de base de datos o la transacción activa. */
export type DbExecutor =
  typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface ReceiveStockLine {
  productId: string;
  quantity: number;
  /** Costo unitario a registrar. Si se pasa `unitCosts`, este valor sólo es el de respaldo. */
  unitCost: number;
  /**
   * Costo por unidad (longitud === quantity). Lo usa la compra para escribir el
   * costo aterrizado exacto de cada serial tras prorratear costos adicionales.
   */
  unitCosts?: number[];
  serials?: string[];
  conditionDetails?: Record<string, unknown> | null;
  notes?: string | null;
  /** Texto que queda en inventory_movements.reason (ej. "Compra #a1b2c3d4"). */
  reason: string;
}

export interface ReceivedStockItem {
  id: string;
  serialNumber: string | null;
  unitCost: number;
}

export interface ReceivedStockLine {
  productId: string;
  productName: string;
  productSku: string | null;
  isSerialized: boolean;
  quantity: number;
  /** Vacío en líneas no serializadas: el stock genérico vive en inventory_movements. */
  items: ReceivedStockItem[];
}

/**
 * Punto único de entrada de mercancía al inventario.
 *
 * Lo usan tanto el ingreso manual (`receiveStock`, sheet de inventario) como el
 * registro de compras (`PurchaseService.createPurchase`), para que ambas rutas
 * apliquen exactamente las mismas reglas:
 *
 * - `isSerialized` se lee SIEMPRE de la BD, nunca del input del cliente.
 * - Los seriales se normalizan y se rechazan vacíos, repetidos dentro del lote
 *   y colisiones con seriales ya existentes en el inventario.
 * - Inserta en lote (una sentencia por tabla), no una por unidad.
 *
 * Recibe el ejecutor de la transacción activa: quien llama decide el alcance
 * transaccional, de modo que el stock y sus efectos contables entren o fallen juntos.
 */
export const receiveStockLines = async (
  tx: DbExecutor,
  lines: ReceiveStockLine[],
): Promise<ReceivedStockLine[]> => {
  if (lines.length === 0) {
    throw new Error("Debe recibir al menos una línea de producto.");
  }

  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new Error("La cantidad de cada línea debe ser un entero positivo.");
    }
  }

  // 1. Catálogo: una sola consulta para todos los productos involucrados
  const productIds = [...new Set(lines.map((line) => line.productId))];
  const catalog = await tx
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      isSerialized: products.isSerialized,
    })
    .from(products)
    .where(inArray(products.id, productIds));

  const catalogById = new Map(catalog.map((product) => [product.id, product]));

  const missing = productIds.filter((id) => !catalogById.has(id));
  if (missing.length > 0) {
    throw new Error(
      `Producto no encontrado en el catálogo: ${missing.join(", ")}`,
    );
  }

  // 2. Seriales: normalización y validación global del lote
  const serialsByLine = lines.map((line, index) => {
    const product = catalogById.get(line.productId)!;
    if (!product.isSerialized) return [];

    const provided = (line.serials ?? []).map(normalizeSerial).filter(Boolean);

    if (provided.length !== line.quantity) {
      throw new Error(
        `${product.name}: se requieren ${line.quantity} serial(es) y se recibieron ${provided.length}.`,
      );
    }

    void index;
    return provided;
  });

  const allSerials = serialsByLine.flat();

  if (allSerials.length > 0) {
    const duplicates = findDuplicateSerials(allSerials);
    if (duplicates.length > 0) {
      throw new Error(
        `Serial(es) repetido(s) en el registro: ${duplicates.join(", ")}`,
      );
    }

    const collisions = await tx
      .select({ serialNumber: productItems.serialNumber })
      .from(productItems)
      .where(
        inArray(
          sql`UPPER(REPLACE(${productItems.serialNumber}, ' ', ''))`,
          allSerials,
        ),
      );

    if (collisions.length > 0) {
      throw new Error(
        `Serial(es) ya registrado(s) en inventario: ${collisions
          .map((row) => row.serialNumber)
          .join(", ")}`,
      );
    }
  }

  // 3. Inserción en lote de los ítems serializados
  const itemRows = lines.flatMap((line, lineIndex) => {
    const product = catalogById.get(line.productId)!;
    if (!product.isSerialized) return [];

    return serialsByLine[lineIndex].map((serial, unitIndex) => ({
      lineIndex,
      values: {
        productId: line.productId,
        serialNumber: serial,
        status: "available" as const,
        unitCost: (line.unitCosts?.[unitIndex] ?? line.unitCost).toString(),
        conditionDetails: line.conditionDetails ?? null,
        notes: line.notes ?? null,
      },
    }));
  });

  const insertedItems = itemRows.length
    ? await tx
        .insert(productItems)
        .values(itemRows.map((row) => row.values))
        .returning({
          id: productItems.id,
          serialNumber: productItems.serialNumber,
          unitCost: productItems.unitCost,
        })
    : [];

  // 4. Movimientos de inventario: uno por unidad serializada, uno por línea genérica
  const movementRows = [
    ...insertedItems.map((item, index) => ({
      productItemId: item.id,
      productId: itemRows[index].values.productId,
      type: "IN",
      quantity: 1,
      unitCost: item.unitCost,
      reason: lines[itemRows[index].lineIndex].reason,
    })),
    ...lines
      .filter((line) => !catalogById.get(line.productId)!.isSerialized)
      .map((line) => ({
        productItemId: null,
        productId: line.productId,
        type: "IN",
        quantity: line.quantity,
        unitCost: line.unitCost.toString(),
        reason: line.reason,
      })),
  ];

  if (movementRows.length > 0) {
    await tx.insert(inventoryMovements).values(movementRows);
  }

  // 5. Resultado agrupado por línea, en el mismo orden recibido
  return lines.map((line, lineIndex) => {
    const product = catalogById.get(line.productId)!;
    const items = insertedItems
      .filter((_, index) => itemRows[index].lineIndex === lineIndex)
      .map((item) => ({
        id: item.id,
        serialNumber: item.serialNumber,
        unitCost: Number(item.unitCost),
      }));

    return {
      productId: line.productId,
      productName: product.name,
      productSku: product.sku,
      isSerialized: product.isSerialized,
      quantity: line.quantity,
      items,
    };
  });
};

/**
 * Ingreso manual de stock desde el inventario (sin proveedor ni movimiento de
 * caja). Es una envoltura de una sola línea sobre `receiveStockLines`, para que
 * comparta validaciones con el registro de compras.
 */
export const receiveStock = async ({
  productId,
  quantity,
  unitCost,
  serials,
  batteryHealth,
  notes,
}: ReceiveStockInput & {
  batteryHealth?: number;
  notes?: string;
}) => {
  return await db.transaction(async (tx) => {
    const [line] = await receiveStockLines(tx, [
      {
        productId,
        quantity,
        unitCost,
        serials,
        conditionDetails: batteryHealth ? { batteryHealth } : null,
        notes: notes || null,
        reason: "Stock Received",
      },
    ]);

    if (line.isSerialized) {
      return {
        success: true,
        type: "serialized",
        items: line.items.map((item) => ({
          id: item.id,
          serialNumber: item.serialNumber,
        })),
      };
    }

    return {
      success: true,
      type: "generic",
      product: { sku: line.productSku, name: line.productName },
      quantity: line.quantity,
    };
  });
};

export const getInventoryItems = async () => {
  return await db
    .select({
      id: productItems.id,
      serial: productItems.serialNumber,
      sku: productItems.sku,
      status: productItems.status,
      createdAt: productItems.createdAt,
      productName: products.name,
      productId: products.id,
      soldDate: sales.createdAt,
    })
    .from(productItems)
    .leftJoin(products, eq(productItems.productId, products.id))
    .leftJoin(saleDetails, eq(productItems.id, saleDetails.productItemId))
    .leftJoin(sales, eq(saleDetails.saleId, sales.id))
    .orderBy(desc(productItems.createdAt));
};

export const getInventoryMovements = async () => {
  return await db
    .select({
      id: inventoryMovements.id,
      type: inventoryMovements.type,
      quantity: inventoryMovements.quantity,
      reason: inventoryMovements.reason,
      createdAt: inventoryMovements.createdAt,
      unitCost: inventoryMovements.unitCost,
      productName: products.name,
      productId: products.id,
      serialNumber: productItems.serialNumber,
      productItemId: inventoryMovements.productItemId,
    })
    .from(inventoryMovements)
    .leftJoin(products, eq(inventoryMovements.productId, products.id))
    .leftJoin(
      productItems,
      eq(inventoryMovements.productItemId, productItems.id),
    )
    .orderBy(desc(inventoryMovements.createdAt));
};

export const getInventoryStats = async () => {
  // Calculate total inventory value (sum of IN movements minus sum of OUT movements)
  const valueResult = await db
    .select({
      totalValue: sql<string>`CAST(COALESCE(SUM(CASE WHEN ${inventoryMovements.type} = 'IN' THEN CAST(${inventoryMovements.unitCost} AS DECIMAL) * ${inventoryMovements.quantity} ELSE -CAST(${inventoryMovements.unitCost} AS DECIMAL) * ${inventoryMovements.quantity} END), 0) AS DECIMAL)`,
    })
    .from(inventoryMovements);

  // Calculate total units (count available product items + sum of non-serialized IN - OUT)
  const serializedUnits = await db
    .select({
      count: sql<string>`COUNT(*)`,
    })
    .from(productItems)
    .where(eq(productItems.status, "available"));

  const nonSerializedUnits = await db
    .select({
      total: sql<string>`SUM(CASE WHEN ${inventoryMovements.type} = 'IN' THEN ${inventoryMovements.quantity} ELSE -${inventoryMovements.quantity} END)`,
    })
    .from(inventoryMovements)
    .where(sql`${inventoryMovements.productItemId} IS NULL`);

  // Convert to numbers explicitly to avoid string concatenation
  const serializedCount = Number(serializedUnits[0]?.count || 0);
  const nonSerializedCount = Number(nonSerializedUnits[0]?.total || 0);
  const totalUnits = serializedCount + nonSerializedCount;

  // Count products with low stock (stock < 5)
  const stockByProduct = await db
    .select({
      productId: inventoryMovements.productId,
      totalStock: sql<string>`SUM(CASE WHEN ${inventoryMovements.type} = 'IN' THEN ${inventoryMovements.quantity} ELSE -${inventoryMovements.quantity} END)`,
    })
    .from(inventoryMovements)
    .groupBy(inventoryMovements.productId);

  const lowStockCount = stockByProduct.filter(
    (p) => Number(p.totalStock || 0) < 5,
  ).length;

  return {
    totalValue: Number(valueResult[0]?.totalValue || 0),
    totalUnits,
    lowStockCount,
  };
};

export const getStockSummary = async () => {
  const stockData = await db
    .select({
      productId: products.id,
      productName: products.name,
      isSerialized: products.isSerialized,
      sku: products.sku,
      attributes: products.attributes,
      totalIn: sql<number>`COALESCE(SUM(CASE WHEN ${inventoryMovements.type} = 'IN' THEN ${inventoryMovements.quantity} ELSE 0 END), 0)`,
      totalOut: sql<number>`COALESCE(SUM(CASE WHEN ${inventoryMovements.type} = 'OUT' THEN ${inventoryMovements.quantity} ELSE 0 END), 0)`,
      avgCost: sql<number>`COALESCE(AVG(CASE WHEN ${inventoryMovements.type} = 'IN' THEN CAST(${inventoryMovements.unitCost} AS DECIMAL) END), 0)`,
    })
    .from(products)
    .leftJoin(inventoryMovements, eq(products.id, inventoryMovements.productId))
    .groupBy(
      products.id,
      products.name,
      products.isSerialized,
      products.sku,
      products.attributes,
    );

  return stockData.map((item) => ({
    productId: item.productId,
    productName: item.productName,
    isSerialized: item.isSerialized,
    sku: item.sku,
    attributes: item.attributes,
    stockTotal: (item.totalIn || 0) - (item.totalOut || 0),
    avgCost: item.avgCost || 0,
    status: (item.totalIn || 0) - (item.totalOut || 0) < 5 ? "low" : "ok",
  }));
};

export const searchInventoryStock = async (query: string) => {
  const cleanQuery = query.trim();

  // Find products matching by name, SKU or having a related serialNumber matching the query
  const matchingProductIdsQuery = await db
    .select({ id: products.id })
    .from(products)
    .leftJoin(productItems, eq(products.id, productItems.productId))
    .where(
      or(
        ilike(products.name, `%${cleanQuery}%`),
        ilike(products.sku, `%${cleanQuery}%`),
        ilike(productItems.serialNumber, `%${cleanQuery}%`),
      ),
    )
    .groupBy(products.id);

  const matchedIds = matchingProductIdsQuery.map((p) => p.id);

  if (matchedIds.length === 0) {
    return [];
  }

  const stockData = await db
    .select({
      productId: products.id,
      productName: products.name,
      isSerialized: products.isSerialized,
      sku: products.sku,
      attributes: products.attributes,
      totalIn: sql<number>`COALESCE(SUM(CASE WHEN ${inventoryMovements.type} = 'IN' THEN ${inventoryMovements.quantity} ELSE 0 END), 0)`,
      totalOut: sql<number>`COALESCE(SUM(CASE WHEN ${inventoryMovements.type} = 'OUT' THEN ${inventoryMovements.quantity} ELSE 0 END), 0)`,
      avgCost: sql<number>`COALESCE(AVG(CASE WHEN ${inventoryMovements.type} = 'IN' THEN CAST(${inventoryMovements.unitCost} AS DECIMAL) END), 0)`,
    })
    .from(products)
    .leftJoin(inventoryMovements, eq(products.id, inventoryMovements.productId))
    .where(inArray(products.id, matchedIds))
    .groupBy(
      products.id,
      products.name,
      products.isSerialized,
      products.sku,
      products.attributes,
    );

  return stockData.map((item) => ({
    productId: item.productId,
    productName: item.productName,
    isSerialized: item.isSerialized,
    sku: item.sku,
    attributes: item.attributes,
    stockTotal: (item.totalIn || 0) - (item.totalOut || 0),
    avgCost: item.avgCost || 0,
    status: (item.totalIn || 0) - (item.totalOut || 0) < 5 ? "low" : "ok",
  }));
};

export const getProductSerials = async (productId: string) => {
  return await db
    .select({
      id: productItems.id,
      serialNumber: productItems.serialNumber,
      sku: productItems.sku,
      status: productItems.status,
      createdAt: productItems.createdAt,
      conditionDetails: productItems.conditionDetails,
      notes: productItems.notes,
      unitCost:
        sql<number>`COALESCE(${inventoryMovements.unitCost}, ${productItems.unitCost})`.mapWith(
          Number,
        ),
    })
    .from(productItems)
    .leftJoin(
      inventoryMovements,
      and(
        eq(productItems.id, inventoryMovements.productItemId),
        eq(inventoryMovements.type, "IN"),
      ),
    )
    .where(eq(productItems.productId, productId))
    .orderBy(desc(productItems.createdAt));
};

/**
 * Corrige un registro serializado ya existente (product_items) que fue
 * capturado de forma errada — ej. costo, serial, SKU, estado o condición.
 *
 * El costo se actualiza también en el movimiento IN asociado en
 * inventory_movements, porque getProductSerials() muestra
 * COALESCE(movimiento.unitCost, item.unitCost) y calculateProductWAC()
 * calcula el promedio a partir de inventory_movements, no de product_items.
 *
 * Nota: esto es una corrección de captura, NO reconcilia ventas ya
 * registradas — cambiar `status` aquí no afecta `sales`/`sale_details`.
 */
export const updateSerialItem = async (input: UpdateSerialItemInput) => {
  return await db.transaction(async (tx) => {
    const current = await tx.query.productItems.findFirst({
      where: eq(productItems.id, input.itemId),
    });

    if (!current) {
      throw new Error(`Registro de inventario ${input.itemId} no encontrado`);
    }

    const currentConditionDetails =
      (current.conditionDetails as Record<string, unknown> | null) || {};
    const newConditionDetails = {
      ...currentConditionDetails,
      ...(input.batteryHealth !== undefined
        ? { batteryHealth: input.batteryHealth }
        : {}),
    };

    const [updated] = await tx
      .update(productItems)
      .set({
        serialNumber: input.serialNumber,
        sku: input.sku,
        status: input.status,
        unitCost: input.unitCost.toString(),
        notes: input.notes ?? null,
        conditionDetails: newConditionDetails,
      })
      .where(eq(productItems.id, input.itemId))
      .returning();

    await tx
      .update(inventoryMovements)
      .set({ unitCost: input.unitCost.toString() })
      .where(
        and(
          eq(inventoryMovements.productItemId, input.itemId),
          eq(inventoryMovements.type, "IN"),
        ),
      );

    // Solo registrar los campos que realmente cambiaron
    const changes: Record<string, { old: unknown; new: unknown }> = {};
    const compare = (key: string, oldValue: unknown, newValue: unknown) => {
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes[key] = { old: oldValue, new: newValue };
      }
    };

    compare("serialNumber", current.serialNumber, input.serialNumber);
    compare("sku", current.sku, input.sku);
    compare("status", current.status, input.status);
    compare("unitCost", Number(current.unitCost), input.unitCost);
    compare("notes", current.notes, input.notes ?? null);
    compare("conditionDetails", currentConditionDetails, newConditionDetails);

    return {
      productId: updated.productId,
      changes,
    };
  });
};

/**
 * Calcula el Costo Promedio Ponderado (WAC) de un producto no serializado.
 * Ecuación: Suma(Cantidad * Costo Unitario) / Suma(Cantidad) para todos los movimientos IN.
 */
export const calculateProductWAC = async (
  productId: string,
  txObj?: DbExecutor,
): Promise<number> => {
  const dbInstance = txObj ?? db;
  const result = await dbInstance
    .select({
      totalQuantity:
        sql<number>`COALESCE(SUM(${inventoryMovements.quantity}), 0)`.mapWith(
          Number,
        ),
      totalValue:
        sql<number>`COALESCE(SUM(${inventoryMovements.quantity} * CAST(${inventoryMovements.unitCost} AS DECIMAL)), 0)`.mapWith(
          Number,
        ),
    })
    .from(inventoryMovements)
    .where(
      and(
        eq(inventoryMovements.productId, productId),
        eq(inventoryMovements.type, "IN"),
      ),
    );

  const data = result[0];

  if (!data || data.totalQuantity === 0) {
    return 0; // Fallback de seguridad si no hay historial de compras
  }

  // Retornar el promedio redondeado a 2 decimales
  return Number((data.totalValue / data.totalQuantity).toFixed(2));
};

/**
 * Resuelve el costo unitario real de una línea de venta.
 *
 * Serializado  → costo del movimiento IN de ese ítem, con fallback a
 *                product_items.unit_cost (el movimiento es la fuente de verdad,
 *                ver updateSerialItem que escribe en ambos).
 * No serializado → WAC del producto.
 *
 * Único punto de resolución de costo: lo usan tanto la venta de contado
 * (pos-service.processSale) como la liquidación de créditos/apartados
 * (layaway-service.completeLayaway).
 */
export const resolveItemCost = async (
  productItemId: string | null,
  productId: string,
  txObj?: DbExecutor,
): Promise<number> => {
  const dbInstance = txObj ?? db;

  if (!productItemId) {
    return await calculateProductWAC(productId, dbInstance);
  }

  const [movement] = await dbInstance
    .select({ unitCost: inventoryMovements.unitCost })
    .from(inventoryMovements)
    .where(
      and(
        eq(inventoryMovements.productItemId, productItemId),
        eq(inventoryMovements.type, "IN"),
      ),
    )
    .limit(1);

  if (movement?.unitCost) {
    return Number(movement.unitCost);
  }

  const [item] = await dbInstance
    .select({ unitCost: productItems.unitCost })
    .from(productItems)
    .where(eq(productItems.id, productItemId))
    .limit(1);

  return Number(item?.unitCost ?? 0);
};
