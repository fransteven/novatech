/**
 * scripts/add-iphone16promax-256-white-inventory.ts
 *
 * Ingresa al inventario un iPhone 16 Pro Max 256GB color blanco:
 *   - Reusa el producto de catálogo existente "iPhone 16 Pro Max" 256GB,
 *     grado batería 93% (id 4e1f93b4-5a00-4e33-b6ec-0c6bae8cc266,
 *     precio venta 3.800.000). No se crea catálogo nuevo.
 *     (El color no se registra como atributo de catálogo en este negocio;
 *     se guarda en las notas del item, siguiendo el patrón observado en
 *     otros product_items, ej. "Nuevo\nBlanco ⚪️".)
 *   - Costo: 3.220.000
 *   - IMEI (inventado): 355706423705287
 *   - Condición: usado (seminuevo), batteryHealth 93 (coincide con el grado
 *     del producto de catálogo elegido)
 *
 * Run: npx tsx scripts/add-iphone16promax-256-white-inventory.ts
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { products, productItems, inventoryMovements } from "../src/db/schema";
import { toDbString } from "../src/lib/money";

const PRODUCT_ID = "4e1f93b4-5a00-4e33-b6ec-0c6bae8cc266"; // iPhone 16 Pro Max 256GB, battery_percentage 93
const IMEI = "355706423705287";
const UNIT_COST = 3_220_000;
const BATTERY_HEALTH = 93;
const NOTES = "Seminuevo\nBlanco ⚪️";

async function main() {
  console.log("\n=== Ingreso inventario: iPhone 16 Pro Max 256GB blanco ===\n");

  // 1. Verificar el producto de catálogo existente
  const [product] = await db.select().from(products).where(eq(products.id, PRODUCT_ID));

  if (!product) {
    console.error(`❌ No se encontró el producto de catálogo ${PRODUCT_ID}. Abortando.`);
    process.exit(1);
  }

  console.log(
    `✅ Producto de catálogo encontrado: ${product.id} | ${product.name} | attributes=${JSON.stringify(product.attributes)} | isSerialized=${product.isSerialized} | price=${product.price}`,
  );

  if (!product.isSerialized) {
    console.error("❌ El producto encontrado no está marcado como serializado (isSerialized=false). Abortando.");
    process.exit(1);
  }

  // 2. Verificar que el IMEI no exista ya
  const [existingItem] = await db
    .select()
    .from(productItems)
    .where(eq(productItems.serialNumber, IMEI));
  if (existingItem) {
    console.error(`❌ Ya existe un product_item con serialNumber=${IMEI} (id=${existingItem.id}). Abortando.`);
    process.exit(1);
  }
  console.log(`✅ IMEI ${IMEI} no está en uso.`);

  // 3. Insertar product_item + movimiento IN dentro de una transacción
  const result = await db.transaction(async (tx) => {
    const [newItem] = await tx
      .insert(productItems)
      .values({
        productId: product.id,
        serialNumber: IMEI,
        status: "available",
        unitCost: toDbString(UNIT_COST),
        conditionDetails: { batteryHealth: BATTERY_HEALTH },
        notes: NOTES,
      })
      .returning();

    await tx.insert(inventoryMovements).values({
      productItemId: newItem.id,
      productId: product.id,
      type: "IN",
      quantity: 1,
      unitCost: toDbString(UNIT_COST),
      reason: "Stock Received",
    });

    return newItem;
  });

  console.log("\n--- Resumen ---");
  console.log("Producto (catálogo):", product.id, "-", product.name);
  console.log("Nuevo product_item:", result.id);
  console.log("IMEI:", result.serialNumber);
  console.log("Costo unitario:", result.unitCost);
  console.log("Estado:", result.status);
  console.log("Condición:", JSON.stringify(result.conditionDetails));
  console.log("\n✅ Equipo ingresado al inventario.\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
