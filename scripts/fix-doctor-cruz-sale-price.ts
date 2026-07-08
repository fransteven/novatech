/**
 * scripts/fix-doctor-cruz-sale-price.ts
 *
 * El script update-doctor-cruz-layaway.ts puso totalAmount = financedCapital = 3.750.000
 * (costo del equipo). El precio de venta real es 4.200.000.
 *
 * Corrige 4 registros en una transacción:
 *   - layaways.totalAmount            3.750.000 → 4.200.000
 *   - layawayDetails.agreedPrice      3.750.000 → 4.200.000
 *   - sales.totalAmount               3.750.000 → 4.200.000
 *   - saleDetails.price               3.750.000 → 4.200.000
 *
 * Run: npx tsx scripts/fix-doctor-cruz-sale-price.ts
 */

import "dotenv/config";
import { eq, and } from "drizzle-orm";
import { db } from "../src/db";
import { layaways, layawayDetails } from "../src/db/schema";
import { sales, saleDetails } from "../src/db/schema/sales";
import { customers } from "../src/db/schema/customers";

const LAYAWAY_ID   = "c8d86076-1f71-4d82-bbe9-b688f156bbfc";
const CORRECT_PRICE = "4200000.00";

async function main() {
  console.log("\n=== fix-doctor-cruz-sale-price ===\n");

  // 1. Verificar estado actual
  const [lay] = await db
    .select({ id: layaways.id, status: layaways.status, totalAmount: layaways.totalAmount, customerId: layaways.customerId })
    .from(layaways)
    .where(eq(layaways.id, LAYAWAY_ID))
    .limit(1);

  if (!lay) { console.error("❌ Layaway no encontrado"); process.exit(1); }

  console.log(`Layaway status: ${lay.status} | totalAmount actual: ${lay.totalAmount}`);

  // 2. Buscar la sale asociada al cliente (creada hoy por completeLayaway)
  const customerSales = await db
    .select({ id: sales.id, totalAmount: sales.totalAmount, createdAt: sales.createdAt })
    .from(sales)
    .where(eq(sales.customerId, lay.customerId))
    .orderBy(sales.createdAt);

  console.log(`\nVentas encontradas para el cliente (${customerSales.length}):`);
  for (const s of customerSales) {
    console.log(`  [${s.id}] ${s.createdAt.toISOString().slice(0, 10)} | ${Number(s.totalAmount).toLocaleString("es-CO")}`);
  }

  // La sale de este crédito es la que tiene totalAmount = 3.750.000
  const saleRecord = customerSales.find((s) => Number(s.totalAmount) === 3_750_000);
  if (!saleRecord) {
    console.error("❌ No se encontró venta con totalAmount=3.750.000 para este cliente.");
    console.error("   Puede que ya haya sido actualizada o que no se haya creado.");
    process.exit(1);
  }

  console.log(`\nSale a corregir: ${saleRecord.id} | ${saleRecord.createdAt.toISOString().slice(0, 10)}`);

  // 3. Ejecutar correcciones en transacción
  await db.transaction(async (tx) => {
    console.log("\n→ Actualizando layaways.totalAmount...");
    await tx.update(layaways)
      .set({ totalAmount: CORRECT_PRICE })
      .where(eq(layaways.id, LAYAWAY_ID));

    console.log("→ Actualizando layawayDetails.agreedPrice...");
    await tx.update(layawayDetails)
      .set({ agreedPrice: CORRECT_PRICE })
      .where(eq(layawayDetails.layawayId, LAYAWAY_ID));

    console.log("→ Actualizando sales.totalAmount...");
    await tx.update(sales)
      .set({ totalAmount: CORRECT_PRICE })
      .where(eq(sales.id, saleRecord.id));

    console.log("→ Actualizando saleDetails.price...");
    await tx.update(saleDetails)
      .set({ price: CORRECT_PRICE })
      .where(eq(saleDetails.saleId, saleRecord.id));
  });

  // 4. Verificar resultado
  const [layAfter] = await db
    .select({ totalAmount: layaways.totalAmount })
    .from(layaways).where(eq(layaways.id, LAYAWAY_ID)).limit(1);

  const [saleAfter] = await db
    .select({ totalAmount: sales.totalAmount })
    .from(sales).where(eq(sales.id, saleRecord.id)).limit(1);

  const detailsAfter = await db
    .select({ price: saleDetails.price })
    .from(saleDetails).where(eq(saleDetails.saleId, saleRecord.id));

  console.log("\n✅ Correcciones aplicadas:");
  console.log(`   layaways.totalAmount:       ${layAfter.totalAmount}`);
  console.log(`   sales.totalAmount:          ${saleAfter.totalAmount}`);
  console.log(`   saleDetails.price:          ${detailsAfter.map((d) => d.price).join(", ")}`);
  console.log("   layawayDetails.agreedPrice: 4200000.00 (actualizado)\n");

  process.exit(0);
}

main().catch((e) => { console.error("❌ Error:", e); process.exit(1); });
