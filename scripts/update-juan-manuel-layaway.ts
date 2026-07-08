/**
 * scripts/update-juan-manuel-layaway.ts
 *
 * Contexto:
 *   Juan Manuel compra iPhone 17 Pro Max 256 a 4,900,000.
 *   Entrega PS5 (2 controles + 1 juego) como parte de pago en especie → 2,000,000.
 *   Queda debiendo 2,900,000 a 6 cuotas SIN interés adicional.
 *   El margen de 200,000 (4,900,000 - 4,700,000 costo) ya está embebido en el precio de venta.
 *
 * Operaciones:
 *   1. Crear categoría "Consolas" + producto "PlayStation 5" + item (costo 2,000,000)
 *      en inventario como activo disponible para revender.
 *   2. Convertir layaway de sin_interes → credito, capital 2,900,000, tasa 0%.
 *   3. Ajustar agreedPrice del detalle a 2,900,000.
 *   4. Insertar cronograma de 6 cuotas iguales sin interés:
 *        C1–C5: 483,333 | C6: 483,335 (ajuste cierre) → total 2,900,000
 *
 * Run: npx tsx scripts/update-juan-manuel-layaway.ts
 */

import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import {
  layaways,
  layawayDetails,
  layawaySchedule,
} from "../src/db/schema";
import {
  categories,
  products,
  productItems,
  inventoryMovements,
} from "../src/db/schema/inventory";
import { toDbString } from "../src/lib/money";

const CUSTOMER_NAME = "Juan Manuel";
const LAYAWAY_ID = "ac9c6d32-76c3-4548-b39d-81e7e52d6de5";

async function main() {
  console.log(`Starting layaway update for ${CUSTOMER_NAME}...`);

  const [lay] = await db
    .select()
    .from(layaways)
    .where(eq(layaways.id, LAYAWAY_ID))
    .limit(1);

  if (!lay) {
    console.error(`❌ Layaway ${LAYAWAY_ID} not found.`);
    process.exit(1);
  }
  console.log("Found layaway:", lay);

  const financedCapital = 2_900_000;
  const termMonths = 6;
  const installment = 483_333;
  const lastInstallment = 483_335; // 5×483,333 + 483,335 = 2,900,000
  const expiresDate = new Date("2026-12-17T12:00:00.000Z");

  // Fechas de cuota: el 17 de cada mes, comenzando julio 2026
  const dueDates = [
    new Date("2026-07-17T12:00:00.000Z"),
    new Date("2026-08-17T12:00:00.000Z"),
    new Date("2026-09-17T12:00:00.000Z"),
    new Date("2026-10-17T12:00:00.000Z"),
    new Date("2026-11-17T12:00:00.000Z"),
    new Date("2026-12-17T12:00:00.000Z"),
  ];

  const schedule = dueDates.map((dueDate, i) => {
    const num = i + 1;
    const total = num === 6 ? lastInstallment : installment;
    const remainingBalance = financedCapital - (num < 6 ? installment * num : financedCapital);
    return { number: num, dueDate, principal: total, interest: 0, totalAmount: total, remainingBalance };
  });

  console.log("Schedule (0% interest, capital only):");
  let checkTotal = 0;
  for (const e of schedule) {
    checkTotal += e.totalAmount;
    console.log(`  C${e.number} | ${e.dueDate.toISOString().slice(0, 10)} | total:${e.totalAmount} | bal:${e.remainingBalance}`);
  }
  console.log(`  Total cuotas: ${checkTotal} (debe ser 2,900,000)`);
  if (checkTotal !== 2_900_000) {
    console.error("❌ Total no cuadra. Aborting.");
    process.exit(1);
  }

  await db.transaction(async (tx) => {
    // ─── 1. PS5 en inventario ──────────────────────────────────────────────
    console.log("\nCreating 'Consolas' category...");
    const [cat] = await tx
      .insert(categories)
      .values({ name: "Consolas", description: "Consolas de videojuegos" })
      .returning();

    console.log("Creating PlayStation 5 product...");
    const [ps5Product] = await tx
      .insert(products)
      .values({
        categoryId: cat.id,
        name: "PlayStation 5",
        description: "Consola PS5",
        price: toDbString(2_000_000),
        isSerialized: true,
        attributes: { incluye: "2 controles + 1 juego" },
      })
      .returning();

    console.log("Creating PS5 product item...");
    const [ps5Item] = await tx
      .insert(productItems)
      .values({
        productId: ps5Product.id,
        unitCost: toDbString(2_000_000),
        status: "available",
        notes: "Recibida como parte de pago de Juan Manuel (crédito iPhone 17 Pro Max). Incluye 2 controles + 1 juego.",
      })
      .returning();

    console.log("Registering inventory movement (IN)...");
    await tx.insert(inventoryMovements).values({
      productItemId: ps5Item.id,
      productId: ps5Product.id,
      type: "IN",
      quantity: 1,
      unitCost: toDbString(2_000_000),
      reason: `Parte de pago en especie — Crédito Juan Manuel #${LAYAWAY_ID.slice(0, 8)}`,
    });

    console.log(`PS5 creada: productId=${ps5Product.id} | itemId=${ps5Item.id}`);

    // ─── 2. Convertir layaway ──────────────────────────────────────────────
    console.log("\nUpdating layaway header...");
    await tx
      .update(layaways)
      .set({
        type: "credito",
        totalAmount: toDbString(financedCapital),
        interestRate: "0.0000",
        financedCapital: toDbString(financedCapital),
        outstandingPrincipal: toDbString(financedCapital),
        termMonths,
        installmentAmount: toDbString(installment),
        expiresAt: expiresDate,
        subStatus: "al_dia",
      })
      .where(eq(layaways.id, LAYAWAY_ID));

    // ─── 3. Ajustar agreedPrice del detalle ───────────────────────────────
    console.log("Updating layaway_details agreedPrice...");
    await tx
      .update(layawayDetails)
      .set({ agreedPrice: toDbString(financedCapital) })
      .where(eq(layawayDetails.layawayId, LAYAWAY_ID));

    // ─── 4. Cronograma ────────────────────────────────────────────────────
    console.log("Replacing schedule...");
    await tx.delete(layawaySchedule).where(eq(layawaySchedule.layawayId, LAYAWAY_ID));
    await tx.insert(layawaySchedule).values(
      schedule.map((e) => ({
        layawayId: LAYAWAY_ID,
        number: e.number,
        dueDate: e.dueDate,
        principal: toDbString(e.principal),
        interest: toDbString(e.interest),
        totalAmount: toDbString(e.totalAmount),
        remainingBalance: toDbString(e.remainingBalance),
        status: "pendiente" as const,
      }))
    );
  });

  console.log(`\n✅ Juan Manuel updated: 6 cuotas sin interés, total 2,900,000.`);
  console.log(`   PS5 (2 controles + 1 juego) en inventario como activo disponible.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
