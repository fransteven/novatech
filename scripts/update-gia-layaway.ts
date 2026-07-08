/**
 * scripts/update-gia-layaway.ts
 *
 * 1. Corrige agreedPrice de 5.000.000 → 4.900.000 en layawayDetails.
 * 2. Registra abono de 2.000.000 en Lulo Bank Mireya (hoy, 2026-06-23).
 *
 * Estado esperado tras el script:
 *   totalAmount:  4.900.000
 *   totalPaid:    4.000.000  (2M previos + 2M hoy)
 *   balance:        900.000
 *
 * Run: npx tsx scripts/update-gia-layaway.ts
 */

import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { layaways, layawayDetails } from "../src/db/schema";
import { cashMovements } from "../src/db/schema/cash";
import { toDbString } from "../src/lib/money";

const LAYAWAY_ID  = "be15476e-9708-4451-83ff-90df1b044aa1"; // GIA JEFE
const ACCOUNT_ID  = "21f77703-1c72-4322-8e45-3a07519f431a"; // Lulo Bank Mireya
const PAYMENT_AMT = 2_000_000;
const CORRECT_PRICE = 4_900_000;
const paidAt = new Date("2026-06-23T12:00:00.000Z");

async function main() {
  console.log("\n=== update-gia-layaway ===\n");

  const [lay] = await db.select().from(layaways).where(eq(layaways.id, LAYAWAY_ID)).limit(1);
  if (!lay) { console.error("❌ Layaway no encontrado"); process.exit(1); }

  console.log(`Status: ${lay.status} | Total: ${Number(lay.totalAmount).toLocaleString("es-CO")}`);

  await db.transaction(async (tx) => {
    // 1. Corregir agreedPrice
    console.log("→ Actualizando agreedPrice a 4.900.000...");
    await tx
      .update(layawayDetails)
      .set({ agreedPrice: toDbString(CORRECT_PRICE) })
      .where(eq(layawayDetails.layawayId, LAYAWAY_ID));

    // 2. Registrar abono de hoy
    console.log("→ Registrando abono de 2.000.000 en Lulo Bank Mireya...");
    await tx.insert(cashMovements).values({
      accountId:     ACCOUNT_ID,
      direction:     "in",
      amount:        toDbString(PAYMENT_AMT),
      sourceType:    "layaway_deposit",
      sourceId:      LAYAWAY_ID,
      paymentMethod: "transfer",
      occurredAt:    paidAt,
      createdAt:     paidAt,
      status:        "posted",
      notes:         "Abono apartado — 2026-06-23",
      createdBy:     null,
    });
  });

  console.log("\n✅ Listo:");
  console.log("   agreedPrice: 4.900.000");
  console.log("   Abono registrado: 2.000.000 (Lulo Bank Mireya)");
  console.log("   Balance: 4.900.000 − 4.000.000 = 900.000 COP\n");
  process.exit(0);
}

main().catch((e) => { console.error("❌ Error:", e); process.exit(1); });
