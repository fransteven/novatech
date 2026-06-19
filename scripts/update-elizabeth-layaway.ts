/**
 * scripts/update-elizabeth-layaway.ts
 *
 * Converts Elizabeth Aux CDO's layaway (sin_interes) to a credit (credito).
 * Device was sold at cost: 1,800,000 COP → financed capital = 1,800,000.
 * Interest rate: 5.73% monthly (0.0573) — derived from solving the annuity
 * formula PMT = P × r × (1+r)³ / ((1+r)³ − 1) = 670,000 for P=1,800,000, n=3.
 * Exact rate ≈ 5.7271% → rounded to 4 decimal places: 0.0573.
 *
 * Schedule (French amortization):
 *   Cuota 1 — 2026-07-17 — 670,000   (int: 103,140 | prin: 566,860)
 *   Cuota 2 — 2026-08-17 — 670,000   (int: 70,658.92 | prin: 599,341.08)
 *   Cuota 3 — 2026-09-17 — 670,115.60 (int: 36,316.68 | prin: 633,798.92 — cierre)
 *
 * Total intereses: 210,115.60 COP
 *
 * Run: npx tsx scripts/update-elizabeth-layaway.ts
 */

import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { layaways, layawaySchedule } from "../src/db/schema";
import { toDbString } from "../src/lib/money";

const CUSTOMER_NAME = "Elizabeth Aux CDO";
const LAYAWAY_ID = "ef6975be-4b68-4fd9-ad13-cddfc55d0816";

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

  const financedCapital = 1_800_000;
  const interestRate = 0.0573; // 5.73% monthly
  const termMonths = 3;
  // Keep original createdAt (2026-06-17). Due dates: 17th of each following month.
  const expiresDate = new Date("2026-09-17T12:00:00.000Z");

  const schedule = [
    {
      number: 1,
      dueDate: new Date("2026-07-17T12:00:00.000Z"),
      principal: 566860,
      interest: 103140,
      totalAmount: 670000,
      remainingBalance: 1233140,
    },
    {
      number: 2,
      dueDate: new Date("2026-08-17T12:00:00.000Z"),
      principal: 599341.08,
      interest: 70658.92,
      totalAmount: 670000,
      remainingBalance: 633798.92,
    },
    {
      number: 3,
      dueDate: new Date("2026-09-17T12:00:00.000Z"),
      principal: 633798.92,
      interest: 36316.68,
      totalAmount: 670115.6,
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
    // agreedPrice already 1,800,000 — no change needed in layaway_details.

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
        installmentAmount: toDbString(670000),
        expiresAt: expiresDate,
        subStatus: "al_dia",
      })
      .where(eq(layaways.id, LAYAWAY_ID));

    console.log("Inserting schedule (no prior schedule to delete)...");
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

  console.log(`\n✅ Elizabeth Aux CDO updated: 3 cuotas @ 670k, tasa 5.73% mensual.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
