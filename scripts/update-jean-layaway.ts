/**
 * scripts/update-jean-layaway.ts
 *
 * Converts Jean's layaway (sin_interes) to a credit (credito).
 * iPhone 15 Pro Max 256 — cash price: 2,500,000 COP → financed capital = 2,500,000.
 * Interest rate: 9.93% monthly (0.0993) — derived from solving PMT = 787,500 for
 * P = 2,500,000, n = 4 using declining balance method.
 *
 * Schedule (declining balance, cuotas 1-3 = 787,500 exact):
 *   Cuota 1 — 2026-07-05 — 787,500  (int: 248,250 | prin: 539,250)
 *   Cuota 2 — 2026-08-05 — 787,500  (int: 194,702 | prin: 592,798)
 *   Cuota 3 — 2026-09-05 — 787,500  (int: 135,838 | prin: 651,662)
 *   Cuota 4 — 2026-10-05 — 787,418  (int:  71,128 | prin: 716,290 — cierre)
 *
 * Total intereses: 649,918 COP
 * Total pagado:  3,149,918 COP
 *
 * Run: npx tsx scripts/update-jean-layaway.ts
 */

import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { layaways, layawayDetails, layawaySchedule } from "../src/db/schema";
import { toDbString } from "../src/lib/money";

const CUSTOMER_NAME = "Jean";
const LAYAWAY_ID = "55402796-d6f9-4ba0-a61d-7cb51e3aba24";

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

  const financedCapital = 2_500_000;
  const interestRate = 0.0993; // 9.93% monthly
  const termMonths = 4;
  const expiresDate = new Date("2026-10-05T12:00:00.000Z");

  const schedule = [
    {
      number: 1,
      dueDate: new Date("2026-07-05T12:00:00.000Z"),
      principal: 539_250,
      interest: 248_250,
      totalAmount: 787_500,
      remainingBalance: 1_960_750,
    },
    {
      number: 2,
      dueDate: new Date("2026-08-05T12:00:00.000Z"),
      principal: 592_798,
      interest: 194_702,
      totalAmount: 787_500,
      remainingBalance: 1_367_952,
    },
    {
      number: 3,
      dueDate: new Date("2026-09-05T12:00:00.000Z"),
      principal: 651_662,
      interest: 135_838,
      totalAmount: 787_500,
      remainingBalance: 716_290,
    },
    {
      number: 4,
      dueDate: new Date("2026-10-05T12:00:00.000Z"),
      principal: 716_290,
      interest: 71_128,
      totalAmount: 787_418,
      remainingBalance: 0,
    },
  ];

  console.log("Schedule:");
  for (const e of schedule) {
    console.log(
      `  Cuota #${e.number} | Due: ${e.dueDate.toISOString().slice(0, 10)} | Int: ${e.interest} | Prin: ${e.principal} | Total: ${e.totalAmount} | Bal: ${e.remainingBalance}`
    );
  }

  await db.transaction(async (tx) => {
    console.log("Updating layaway header...");
    await tx
      .update(layaways)
      .set({
        type: "credito",
        totalAmount: toDbString(financedCapital),
        interestRate: interestRate.toFixed(4),
        financedCapital: toDbString(financedCapital),
        outstandingPrincipal: toDbString(financedCapital),
        termMonths,
        installmentAmount: toDbString(787_500),
        expiresAt: expiresDate,
        subStatus: "al_dia",
      })
      .where(eq(layaways.id, LAYAWAY_ID));

    console.log("Updating agreedPrice in layaway_details...");
    await tx
      .update(layawayDetails)
      .set({ agreedPrice: toDbString(financedCapital) })
      .where(eq(layawayDetails.layawayId, LAYAWAY_ID));

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

  console.log(`\n✅ Jean updated: 4 cuotas @ 787,500 (última 787,418), tasa 9.93% mensual.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
