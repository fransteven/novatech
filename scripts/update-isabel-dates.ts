/**
 * scripts/update-isabel-dates.ts
 *
 * Reprograma las fechas del crédito de Isabel Guzman.
 * Producto se entrega el 1 de julio de 2026 → cuota #1 = 1/8/2026.
 * Solo modifica dueDate en layaway_schedule y expiresAt en layaways.
 * Montos, capital, interés y número de cuotas NO cambian.
 *
 * Fechas nuevas:
 *   #1 — 2026-08-01
 *   #2 — 2026-09-01
 *   #3 — 2026-10-01
 *   #4 — 2026-11-01
 *   #5 — 2026-12-01
 *   #6 — 2027-01-01
 *
 * Run: npx tsx scripts/update-isabel-dates.ts
 */

import "dotenv/config";
import { eq, and } from "drizzle-orm";
import { db } from "../src/db";
import { layaways, layawaySchedule } from "../src/db/schema";

const CUSTOMER_NAME = "Isabel Guzman";
const LAYAWAY_ID = "a9bb4a57-3bb0-4b80-87d5-43c2655c8e03";

const newDates: { number: number; dueDate: Date }[] = [
  { number: 1, dueDate: new Date("2026-08-01T12:00:00.000Z") },
  { number: 2, dueDate: new Date("2026-09-01T12:00:00.000Z") },
  { number: 3, dueDate: new Date("2026-10-01T12:00:00.000Z") },
  { number: 4, dueDate: new Date("2026-11-01T12:00:00.000Z") },
  { number: 5, dueDate: new Date("2026-12-01T12:00:00.000Z") },
  { number: 6, dueDate: new Date("2027-01-01T12:00:00.000Z") },
];

const newExpiresAt = new Date("2027-01-01T12:00:00.000Z");

async function main() {
  console.log(`Reprogramando fechas de ${CUSTOMER_NAME}...`);

  const [lay] = await db
    .select()
    .from(layaways)
    .where(eq(layaways.id, LAYAWAY_ID))
    .limit(1);

  if (!lay) {
    console.error(`❌ Layaway ${LAYAWAY_ID} no encontrado.`);
    process.exit(1);
  }

  console.log(`Crédito encontrado: id=${lay.id} type=${lay.type} status=${lay.status} expiresAt=${lay.expiresAt}`);

  console.log("\nFechas nuevas del schedule:");
  for (const e of newDates) {
    console.log(`  #${e.number} → ${e.dueDate.toISOString().slice(0, 10)}`);
  }

  await db.transaction(async (tx) => {
    // Actualizar dueDate de cada cuota individualmente (preserva status/paidAt/montos)
    for (const e of newDates) {
      await tx
        .update(layawaySchedule)
        .set({ dueDate: e.dueDate })
        .where(
          and(
            eq(layawaySchedule.layawayId, LAYAWAY_ID),
            eq(layawaySchedule.number, e.number)
          )
        );
    }

    // Actualizar expiresAt en la cabecera
    await tx
      .update(layaways)
      .set({ expiresAt: newExpiresAt })
      .where(eq(layaways.id, LAYAWAY_ID));
  });

  console.log(`\n✅ Fechas actualizadas para ${CUSTOMER_NAME}.`);
  console.log(`   Cuota #1: 2026-08-01 | Cuota #6: 2027-01-01 | expiresAt: 2027-01-01`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
