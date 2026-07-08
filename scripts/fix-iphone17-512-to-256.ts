/**
 * scripts/fix-iphone17-512-to-256.ts
 *
 * Corrige un error de registro: 3 iPhone 17 Pro Max fueron ingresados como
 * 512GB (sin IMEI real, placeholder ".") cuando en realidad son de 256GB.
 * Ninguno se había comprado ni vendido (los 3 estaban "available").
 *
 * Pasos:
 *  1. Verifica el producto 512GB (id 9b954931-65f0-4f57-ad84-0c60c922a894) y
 *     sus 3 product_items — aborta si no calzan las guardas de seguridad.
 *  2. Reutiliza el producto 256GB YA EXISTENTE en catálogo
 *     (id 70127100-5bf0-42b6-b885-f17d25e98cb0) — no se crea uno nuevo.
 *  3. Borra los 3 product_items 512GB + sus inventory_movements + la fila
 *     de producto 512GB.
 *  4. Genera 3 IMEI (15 dígitos, checksum Luhn) que no colisionan con
 *     ningún serial_number existente en la base.
 *  5. Crea los 3 product_items 256GB (available, unitCost 4,000,000) +
 *     movimientos IN, preservando la fecha de ingreso original (2026-06-26).
 *  6. Crea el cliente "Masterplay" (tel. 302 6694355).
 *  7. Registra la venta de los 3 equipos a Masterplay con fecha 2026-06-19,
 *     precio 4,300,000 c/u (total 12,900,000), y marca los items "sold".
 *
 * Run: npx tsx scripts/fix-iphone17-512-to-256.ts
 */
import "dotenv/config";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../src/db";
import {
  products,
  productItems,
  inventoryMovements,
  sales,
  saleDetails,
  customers,
} from "../src/db/schema";
import { toDbString } from "../src/lib/money";

const PRODUCT_512_ID = "9b954931-65f0-4f57-ad84-0c60c922a894";
const PRODUCT_256_ID = "70127100-5bf0-42b6-b885-f17d25e98cb0";
const ITEM_IDS_512 = [
  "cf29ce04-d9c1-48c2-bb7e-10371a2204bb",
  "1806bcb0-4d50-4b5c-8e90-36e322b69245",
  "c4226d6c-48b0-463c-bd64-9ce3533941a2",
];

const UNIT_COST = 4_000_000;
const SALE_PRICE = 4_300_000;
const ORIGINAL_RECEIVED_AT = new Date("2026-06-26T15:34:23.216Z"); // fecha de ingreso original (se preserva)
const SALE_DATE = new Date("2026-06-19T12:00:00.000Z");

const CUSTOMER_NAME = "Masterplay";
const CUSTOMER_PHONE = "302 6694355";

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

async function main() {
  console.log("Corrigiendo iPhone 17 Pro Max 512GB → 256GB + venta Masterplay...\n");

  const result = await db.transaction(async (tx) => {
    // 1. Verificar producto 512GB y sus items
    const [product512] = await tx
      .select()
      .from(products)
      .where(eq(products.id, PRODUCT_512_ID));
    if (!product512) throw new Error(`Producto 512GB ${PRODUCT_512_ID} no encontrado.`);

    const items512 = await tx
      .select()
      .from(productItems)
      .where(inArray(productItems.id, ITEM_IDS_512));
    if (items512.length !== 3) {
      throw new Error(`Se esperaban 3 items 512GB, se encontraron ${items512.length}.`);
    }
    if (items512.some((i) => i.status !== "available")) {
      throw new Error("Alguno de los items 512GB no está 'available'. Abortando.");
    }

    const priorSales = await tx
      .select()
      .from(saleDetails)
      .where(inArray(saleDetails.productItemId, ITEM_IDS_512));
    if (priorSales.length > 0) {
      throw new Error("Ya existen ventas asociadas a estos items 512GB. Abortando.");
    }

    // 2. Verificar que el producto 256GB destino existe (ya está en catálogo)
    const [product256] = await tx
      .select()
      .from(products)
      .where(eq(products.id, PRODUCT_256_ID));
    if (!product256) throw new Error(`Producto 256GB ${PRODUCT_256_ID} no encontrado.`);

    // 3. Borrar los 3 items 512GB + sus movimientos + el producto 512GB
    await tx
      .delete(inventoryMovements)
      .where(inArray(inventoryMovements.productItemId, ITEM_IDS_512));
    await tx.delete(productItems).where(inArray(productItems.id, ITEM_IDS_512));
    await tx.delete(products).where(eq(products.id, PRODUCT_512_ID));
    console.log(`✅ Eliminados 3 items + producto 512GB (${PRODUCT_512_ID}).`);

    // 4. Generar 3 IMEI únicos frente a TODOS los serial_number existentes
    const existingSerialsRows = await tx
      .select({ serial: productItems.serialNumber })
      .from(productItems);
    const existingSerials = new Set(
      existingSerialsRows.map((r) => r.serial).filter((s): s is string => !!s),
    );
    const newImeis = [1, 2, 3].map(() => generateImei(existingSerials));
    console.log("✅ IMEI generados:", newImeis);

    // 5. Crear los 3 items 256GB (available) + movimientos IN
    const newItemIds: string[] = [];
    for (const imei of newImeis) {
      const [newItem] = await tx
        .insert(productItems)
        .values({
          productId: PRODUCT_256_ID,
          serialNumber: imei,
          status: "available",
          unitCost: toDbString(UNIT_COST),
          conditionDetails: { batteryHealth: 100 },
          notes: "Nuevo",
          createdAt: ORIGINAL_RECEIVED_AT,
        })
        .returning({ id: productItems.id });
      newItemIds.push(newItem.id);

      await tx.insert(inventoryMovements).values({
        productItemId: newItem.id,
        productId: PRODUCT_256_ID,
        type: "IN",
        quantity: 1,
        unitCost: toDbString(UNIT_COST),
        reason: "Corrección 512GB→256GB",
        createdAt: ORIGINAL_RECEIVED_AT,
      });
    }
    console.log(`✅ Creados 3 items 256GB en producto ${PRODUCT_256_ID}:`, newItemIds);

    // 6. Crear cliente Masterplay
    const [existingCustomer] = await tx
      .select()
      .from(customers)
      .where(eq(customers.name, CUSTOMER_NAME));
    const customer =
      existingCustomer ||
      (
        await tx
          .insert(customers)
          .values({ name: CUSTOMER_NAME, phone: CUSTOMER_PHONE })
          .returning()
      )[0];
    console.log("✅ Cliente Masterplay:", customer);

    // 7. Registrar la venta (fecha 2026-06-19)
    const totalAmount = SALE_PRICE * 3;
    const [sale] = await tx
      .insert(sales)
      .values({
        customerId: customer.id,
        totalAmount: toDbString(totalAmount),
        status: "completed",
        createdAt: SALE_DATE,
      })
      .returning();

    for (const itemId of newItemIds) {
      await tx.insert(saleDetails).values({
        saleId: sale.id,
        productItemId: itemId,
        productId: PRODUCT_256_ID,
        unitCost: toDbString(UNIT_COST),
        price: toDbString(SALE_PRICE),
      });

      await tx
        .update(productItems)
        .set({ status: "sold" })
        .where(eq(productItems.id, itemId));

      await tx.insert(inventoryMovements).values({
        productItemId: itemId,
        productId: PRODUCT_256_ID,
        type: "OUT",
        quantity: 1,
        unitCost: toDbString(UNIT_COST),
        reason: "Venta Masterplay",
        createdAt: SALE_DATE,
      });
    }

    console.log(`✅ Venta registrada: ${sale.id} — total ${toDbString(totalAmount)}`);

    return { customer, sale, newItemIds, newImeis };
  });

  console.log("\n--- Resumen ---");
  console.log("Cliente Masterplay:", result.customer.id);
  console.log("Venta:", result.sale.id, "| Total:", result.sale.totalAmount, "| Fecha:", result.sale.createdAt);
  console.log("Items 256GB creados y vendidos:", result.newItemIds);
  console.log("IMEIs asignados:", result.newImeis);

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
