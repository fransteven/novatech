/**
 * scripts/add-iphone14-pro-128.ts
 *
 * Ingresa al inventario un iPhone 14 Pro 128GB (IMEI inventado, único frente
 * a todos los serial_number existentes).
 *
 * Pasos:
 *  1. Busca (o crea) el producto de catálogo "iPhone 14 Pro" 128GB.
 *  2. Genera un IMEI de 15 dígitos (checksum Luhn) que no colisiona con
 *     ningún serial_number existente.
 *  3. Crea el product_item (available, unitCost 1,300,000, batería 88%).
 *  4. Registra el movimiento IN correspondiente.
 *
 * Run: npx tsx scripts/add-iphone14-pro-128.ts
 */
import "dotenv/config";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../src/db";
import { products, productItems, inventoryMovements } from "../src/db/schema";
import { toDbString } from "../src/lib/money";

const CATEGORY_ID = "b895aa20-fdd7-4bc6-9723-8db1c4d494fd"; // smartphones
const PRODUCT_NAME = "iPhone 14 Pro";
const ATTRIBUTES = { storage: "128", ram_memory: "6", battery_percentage: "88" };
const SALE_PRICE = 1_800_000;
const UNIT_COST = 1_300_000;
const BATTERY_HEALTH = 88;

/** Dígito de verificación Luhn para un payload de 14 dígitos → IMEI de 15. */
function luhnCheckDigit(payload: string): string {
  const digits = payload.split("").map(Number).reverse();
  let total = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = digits[i];
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    total += d;
  }
  return ((10 - (total % 10)) % 10).toString();
}

function generateImei(existing: Set<string>): string {
  let imei: string;
  do {
    let payload = "35"; // prefijo TAC típico de Apple observado en la data existente
    for (let i = 0; i < 12; i++) payload += Math.floor(Math.random() * 10);
    imei = payload + luhnCheckDigit(payload);
  } while (existing.has(imei));
  existing.add(imei);
  return imei;
}

function randomSkuSuffix(): string {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

async function main() {
  console.log("Ingresando iPhone 14 Pro 128GB al inventario...\n");

  const result = await db.transaction(async (tx) => {
    // 1. Buscar o crear el producto de catálogo
    const attrsJson = JSON.stringify(ATTRIBUTES);
    const [existingProduct] = await tx
      .select()
      .from(products)
      .where(
        and(
          sql`TRIM(LOWER(${products.name})) = TRIM(LOWER(${PRODUCT_NAME}))`,
          sql`COALESCE((${products.attributes})::text, '') = ${attrsJson}`,
        ),
      )
      .limit(1);

    let product = existingProduct;
    if (!product) {
      const [newProduct] = await tx
        .insert(products)
        .values({
          name: PRODUCT_NAME,
          sku: `SMA-IPH14-128-${randomSkuSuffix()}`,
          price: toDbString(SALE_PRICE),
          isSerialized: true,
          attributes: ATTRIBUTES,
          categoryId: CATEGORY_ID,
        })
        .returning();
      product = newProduct;
      console.log(`✅ Producto de catálogo creado: ${product.id} (${product.name})`);
    } else {
      console.log(`✅ Producto de catálogo ya existía: ${product.id} (${product.name})`);
    }

    // 2. Generar IMEI único frente a TODOS los serial_number existentes
    const existingSerialsRows = await tx
      .select({ serial: productItems.serialNumber })
      .from(productItems);
    const existingSerials = new Set(
      existingSerialsRows.map((r) => r.serial).filter((s): s is string => !!s),
    );
    const imei = generateImei(existingSerials);
    console.log("✅ IMEI generado:", imei);

    // 3. Crear el product_item
    const [newItem] = await tx
      .insert(productItems)
      .values({
        productId: product.id,
        serialNumber: imei,
        status: "available",
        unitCost: toDbString(UNIT_COST),
        conditionDetails: { batteryHealth: BATTERY_HEALTH },
        notes: "Ingreso inventario",
      })
      .returning();
    console.log(`✅ Item creado: ${newItem.id}`);

    // 4. Registrar el movimiento IN
    await tx.insert(inventoryMovements).values({
      productItemId: newItem.id,
      productId: product.id,
      type: "IN",
      quantity: 1,
      unitCost: toDbString(UNIT_COST),
      reason: "Ingreso inventario",
    });

    return { product, item: newItem, imei };
  });

  console.log("\n--- Resumen ---");
  console.log("Producto:", result.product.id, "-", result.product.name);
  console.log("Item:", result.item.id);
  console.log("IMEI:", result.imei);
  console.log("Costo:", toDbString(UNIT_COST), "| Precio venta:", toDbString(SALE_PRICE));

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
