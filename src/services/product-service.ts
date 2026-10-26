import { db } from "@/db";
import {
  products,
  productItems,
  inventoryMovements,
  categories,
  productBarcodes,
} from "@/db/schema";
import { eq, desc, sql, and, isNull } from "drizzle-orm";
import { ProductInput } from "@/lib/validators/product-validator";
import { generateBaseSKU } from "@/lib/utils";
import type { DbExecutor } from "@/services/inventory-service";

/** SKU interno autogenerado: base legible + sufijo aleatorio de 8 caracteres. */
export const generateProductSku = (
  categoryName: string,
  productName: string,
  attributes?: Record<string, unknown>,
): string => {
  const suffix = (
    Math.random().toString(36).substring(2, 10).toUpperCase() +
    Math.random().toString(36).substring(2, 4).toUpperCase()
  ).substring(0, 8);
  return `${generateBaseSKU(categoryName, productName, attributes)}-${suffix}`;
};

export type ProductWithStock = Awaited<ReturnType<typeof getProducts>>[number];

export const getProducts = async () => {
  return await db
    .select({
      id: products.id,
      name: products.name,
      description: products.description,
      sku: products.sku,
      categoryId: products.categoryId,
      price: products.price,
      isSerialized: products.isSerialized,
      warrantyMonths: products.warrantyMonths,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
      //COALESCE funciona como un if null, si el resultado es null, devuelve 0
      stock: sql<number>`
        CASE
          WHEN ${products.isSerialized} THEN (
            SELECT COUNT(*)
            FROM ${productItems}
            WHERE ${productItems.productId} = ${products.id}
              AND ${productItems.status} = 'available'
          )
          ELSE (
            COALESCE((
              SELECT SUM(${inventoryMovements.quantity})
              FROM ${inventoryMovements}
              WHERE ${inventoryMovements.productId} = ${products.id}
                AND ${inventoryMovements.type} = 'IN'
            ), 0) -
            COALESCE((
              SELECT SUM(${inventoryMovements.quantity})
              FROM ${inventoryMovements}
              WHERE ${inventoryMovements.productId} = ${products.id}
                AND ${inventoryMovements.type} = 'OUT'
            ), 0)
          )
        END
      `.mapWith(Number),
      categoryName: categories.name,
      categoryTemplate: categories.template,
      attributes: products.attributes,
      // Seriales de caja / UPC: los buscadores del cliente filtran también por ellos.
      barcodes: sql<string[]>`COALESCE((
        SELECT array_agg(${productBarcodes.code})
        FROM ${productBarcodes}
        WHERE ${productBarcodes.productId} = ${products.id}
      ), '{}')`,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .orderBy(desc(products.createdAt));
};

export const getProductById = async (id: string) => {
  const result = await db.select().from(products).where(eq(products.id, id));
  if (result.length === 0) return null;
  return result[0];
};

export const createProduct = async (
  data: ProductInput & { sku?: string },
  executor: DbExecutor = db,
) => {
  const attrsJson = data.attributes ? JSON.stringify(data.attributes) : null;

  const existingProduct = await executor
    .select()
    .from(products)
    .where(
      and(
        sql`TRIM(LOWER(${products.name})) = TRIM(LOWER(${data.name}))`,
        attrsJson
          ? sql`COALESCE((${products.attributes})::text, '') = ${attrsJson}`
          : isNull(products.attributes),
      ),
    )
    .limit(1);

  if (existingProduct.length > 0) {
    throw new Error(
      "Ya existe un producto con este nombre y las mismas especificaciones.",
    );
  }

  const result = await executor.insert(products).values(data).returning();
  return result[0];
};

export const updateProduct = async (
  id: string,
  data: Partial<ProductInput>,
) => {
  const result = await db
    .update(products)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning();

  if (result.length === 0) return null;
  return result[0];
};

export const deleteProduct = async (id: string) => {
  // 1. Verificación de Integridad: No podemos borrar si hay inventario asociado
  const hasInventory = await db
    .select({ id: inventoryMovements.id })
    .from(inventoryMovements)
    .where(eq(inventoryMovements.productId, id))
    .limit(1);

  if (hasInventory.length > 0) {
    throw new Error(
      "No se puede eliminar el producto porque tiene movimientos de inventario asociados. Borrarlo alteraría el historial financiero y de stock.",
    );
  }

  const hasItems = await db
    .select({ id: productItems.id })
    .from(productItems)
    .where(eq(productItems.productId, id))
    .limit(1);

  if (hasItems.length > 0) {
    throw new Error(
      "No se puede eliminar el producto porque tiene seriales/IMEIs registrados en el sistema.",
    );
  }

  // Si pasamos las validaciones, procedemos con el borrado
  const result = await db
    .delete(products)
    .where(eq(products.id, id))
    .returning();
  if (result.length === 0) return null;
  return result[0];
};
