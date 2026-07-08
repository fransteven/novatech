import { db } from "@/db";
import {
  products,
  productItems,
  inventoryMovements,
  sales,
  saleDetails,
  cashMovements,
} from "@/db/schema";
import { eq, sql, and } from "drizzle-orm";
import type {
  ProductSearchResult,
  ProcessSaleInput,
} from "@/lib/validators/pos-validator";
import { calculateProductWAC } from "@/services/inventory-service";

/**
 * Search for a product by barcode (SKU or serial number)
 * Returns product details including available quantity and average unit cost
 */
/**
 * Search for a product by barcode (SKU or serial number) or Name
 */
export const searchProduct = async (
  query: string,
): Promise<ProductSearchResult | null> => {
  // Limpiamos el query de posibles saltos de línea o espacios del escáner
  const cleanQuery = query.trim();

  // 1. INTENTO SERIALIZADO (Precisión Absoluta)
  // Buscamos si el input corresponde al QR (ID) o al IMEI escrito a mano.
  const itemResult = await db
    .select({
      productItem: productItems,
      product: products,
    })
    .from(productItems)
    .innerJoin(products, eq(productItems.productId, products.id))
    .where(
      // Se castea productItems.id a texto para poder compararlo con el string del escáner
      sql`${productItems.id}::text = ${cleanQuery} OR ${productItems.serialNumber} = ${cleanQuery}`,
    )
    .limit(1);

  if (itemResult.length > 0) {
    const { productItem, product } = itemResult[0];

    // Buscamos el costo real de este item específico en sus movimientos de entrada
    const costMovement = await db
      .select({
        unitCost: inventoryMovements.unitCost,
      })
      .from(inventoryMovements)
      .where(
        and(
          eq(inventoryMovements.productItemId, productItem.id),
          eq(inventoryMovements.type, "IN"),
        ),
      )
      .limit(1);

    const itemCost = Number(costMovement[0]?.unitCost || productItem.unitCost || 0);

    return {
      productId: product.id,
      productItemId: productItem.id,
      name: product.name,
      suggestedPrice: product.price,
      availableQty: productItem.status === "available" ? 1 : 0,
      avgUnitCost: itemCost,
      isSerialized: true,
      sku: product.sku, // El SKU de la tabla padre
    };
  }

  // 2. INTENTO NO SERIALIZADO / BÚSQUEDA GENERAL (Precisión Alta -> Precisión Baja)
  // Buscamos coincidencia exacta de Código de Barras (SKU) o búsqueda manual por Nombre
  const productResult = await db
    .select()
    .from(products)
    .where(
      sql`${products.sku} = ${cleanQuery} OR ${products.name} ILIKE ${`%${cleanQuery}%`}`,
    )
    .limit(1);

  if (productResult.length === 0) {
    return null; // El producto no existe
  }

  const product = productResult[0];
  let availableQty = 0;
  let avgUnitCost = 0;

  if (product.isSerialized) {
    // Si buscó "iPhone" por nombre, contamos el stock global de la familia
    const availableItems = await db
      .select({ count: sql<string>`COUNT(*)` })
      .from(productItems)
      .where(
        and(
          eq(productItems.productId, product.id),
          eq(productItems.status, "available"),
        ),
      );
    availableQty = Number(availableItems[0]?.count || 0);

    // Calculamos un costo promedio aproximado de los items disponibles
    const avgCostQuery = await db
      .select({ avgCost: sql<string>`AVG(${productItems.unitCost})` })
      .from(productItems)
      .where(
        and(
          eq(productItems.productId, product.id),
          eq(productItems.status, "available"),
        ),
      );
    avgUnitCost = Number(avgCostQuery[0]?.avgCost || 0);
  } else {
    // Cálculo de stock FIFO para No Serializados
    const movements = await db
      .select({
        total: sql<string>`SUM(CASE WHEN ${inventoryMovements.type} = 'IN' THEN ${inventoryMovements.quantity} ELSE -${inventoryMovements.quantity} END)`,
      })
      .from(inventoryMovements)
      .where(eq(inventoryMovements.productId, product.id));

    availableQty = Number(movements[0]?.total || 0);

    avgUnitCost = await calculateProductWAC(product.id, db);
  }

  return {
    productId: product.id,
    productItemId: null,
    name: product.name,
    suggestedPrice: product.price,
    availableQty,
    avgUnitCost,
    isSerialized: product.isSerialized,
    sku: product.sku,
  };
};

/**
 * Process a sale transaction
 */
export const processSale = async ({
  items,
  totalAmount,
  userId,
  payments,
}: ProcessSaleInput) => {
  return await db.transaction(async (tx) => {
    // 1. Create the sale record
    const [sale] = await tx
      .insert(sales)
      .values({
        userId,
        totalAmount: totalAmount.toString(),
        status: "completed",
      })
      .returning({ id: sales.id });

    if (!sale) {
      throw new Error("Failed to create sale record");
    }

    // 2. Process each sale item
    for (const item of items) {
      if (item.isSerialized && !item.productItemId) {
        throw new Error(
          `Cannot sell serialized product "${item.productId}" without serial number (productItemId)`,
        );
      }

      let itemCost = 0;
      let avgUnitCost = 0;

      // STOCK VALIDATION
      if (item.isSerialized && item.productItemId) {
        // Validate serialized item exists and is available
        const [productItem] = await tx
          .select()
          .from(productItems)
          .where(eq(productItems.id, item.productItemId))
          .limit(1);

        if (!productItem) {
          throw new Error(
            `Product item with ID ${item.productItemId} not found`,
          );
        }

        if (productItem.status !== "available") {
          throw new Error(
            `Product item "${productItem.sku || productItem.serialNumber}" is not available (status: ${productItem.status})`,
          );
        }

        // MINIMUM PRICE VALIDATION for serialized items (price >= cost)
        // Get the cost from inventory movements for this specific item
        const costMovement = await tx
          .select({
            unitCost: inventoryMovements.unitCost,
          })
          .from(inventoryMovements)
          .where(
            and(
              eq(inventoryMovements.productItemId, item.productItemId),
              eq(inventoryMovements.type, "IN"),
            ),
          )
          .limit(1);

        itemCost = Number(costMovement[0]?.unitCost || productItem.unitCost || 0);
        if (item.price < itemCost) {
          throw new Error(
            `El precio de venta no puede ser menor al costo del producto. Costo: $${itemCost.toLocaleString()}, Precio ingresado: $${item.price.toLocaleString()}`,
          );
        }
      } else {
        // Validate non-serialized item has sufficient stock
        const movements = await tx
          .select({
            total: sql<string>`SUM(CASE WHEN ${inventoryMovements.type} = 'IN' THEN ${inventoryMovements.quantity} ELSE -${inventoryMovements.quantity} END)`,
          })
          .from(inventoryMovements)
          .where(eq(inventoryMovements.productId, item.productId));

        const currentStock = Number(movements[0]?.total || 0);

        if (currentStock < item.quantity) {
          // Get product name for better error message
          const [product] = await tx
            .select({ name: products.name })
            .from(products)
            .where(eq(products.id, item.productId))
            .limit(1);

          throw new Error(
            `Insufficient stock for "${product?.name || item.productId}". Available: ${currentStock}, Requested: ${item.quantity}`,
          );
        }

        // MINIMUM PRICE VALIDATION for non-serialized items (price >= cost)
        // Calculate Weighted Average Cost (WAC) from inventory movements
        avgUnitCost = await calculateProductWAC(item.productId, tx);
        if (item.price < avgUnitCost) {
          // Get product name for better error message
          const [product] = await tx
            .select({ name: products.name })
            .from(products)
            .where(eq(products.id, item.productId))
            .limit(1);

          throw new Error(
            `El precio de venta no puede ser menor al costo del producto "${product?.name || item.productId}". Costo promedio: $${avgUnitCost.toLocaleString()}, Precio ingresado: $${item.price.toLocaleString()}`,
          );
        }
      }

      // Insert sale detail
      await tx.insert(saleDetails).values({
        saleId: sale.id,
        productId: item.productId,
        productItemId: item.productItemId || null,
        unitCost: item.isSerialized
          ? itemCost!.toString()
          : avgUnitCost!.toString(),
        price: item.price.toString(),
      });

      // If product is serialized, update the product item status to 'sold'
      if (item.isSerialized && item.productItemId) {
        await tx
          .update(productItems)
          .set({ status: "sold" })
          .where(eq(productItems.id, item.productItemId));
      }

      // Create inventory OUT movement
      await tx.insert(inventoryMovements).values({
        productItemId: item.productItemId || null,
        productId: item.productId,
        type: "OUT",
        quantity: item.quantity,
        unitCost: item.isSerialized
          ? itemCost!.toString()
          : avgUnitCost!.toString(), // Using actual cost instead of sale price
        reason: `Sale #${sale.id}`,
      });
    }

    // Insert cash movements for each payment (if provided)
    if (payments && payments.length > 0) {
      for (const payment of payments) {
        await tx.insert(cashMovements).values({
          direction: "in",
          sourceType: "sale_payment",
          sourceId: sale.id,
          accountId: payment.accountId,
          paymentMethod: payment.method,
          amount: payment.amount.toString(),
          referenceCode: payment.referenceCode ?? null,
          notes: payment.notes ?? null,
          createdBy: userId ?? null,
          status: "posted",
        });
      }
    }

    return { success: true, saleId: sale.id };
  });
};
