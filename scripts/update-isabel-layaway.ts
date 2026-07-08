/**
 * scripts/update-isabel-layaway.ts
 *
 * Converts Isabel Guzman's layaway (sin_interes) to a credit (credito).
 * Device sold at cost: 3,550,000 COP (IMEI 350912504997745).
 * Profit from interest only.
 *
 * Interest rate: 5.03% monthly (0.0503) — derived by solving the annuity
 * formula PMT = P × r × (1+r)^n / ((1+r)^n − 1) = 700,000
 * for P=3,550,000, n=6. Exact rate ≈ 5.029% → rounded to 4 dp: 0.0503.
 *
 * Schedule (French amortization, cuotas 1-5 = 700,000, cuota 6 closes balance):
 *   #1 — 2026-07-17 — 700,000.00   (int: 178,565.00  | prin: 521,435.00   | bal: 3,028,565.00)
 *   #2 — 2026-08-17 — 700,000.00   (int: 152,336.82  | prin: 547,663.18   | bal: 2,480,901.82)
 *   #3 — 2026-09-17 — 700,000.00   (int: 124,789.36  | prin: 575,210.64   | bal: 1,905,691.18)
 *   #4 — 2026-10-17 — 700,000.00   (int:  95,856.27  | prin: 604,143.73   | bal: 1,301,547.45)
 *   #5 — 2026-11-17 — 700,000.00   (int:  65,467.84  | prin: 634,532.16   | bal:   667,015.29)
 *   #6 — 2026-12-17 — 700,566.16   (int:  33,550.87  | prin: 667,015.29   | bal:         0.00)
 *
 * Total intereses: 650,566.16 COP
 *
 * Run: npx tsx scripts/update-isabel-layaway.ts
 */

import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { layaways, layawaySchedule } from "../src/db/schema";
import { toDbString } from "../src/lib/money";

const CUSTOMER_NAME = "Isabel Guzman";
const LAYAWAY_ID = "a9bb4a57-3bb0-4b80-87d5-43c2655c8e03";

const financedCapital = 3_550_000;
const interestRate = 0.0503; // 5.03% mensual
const termMonths = 6;
const expiresDate = new Date("2026-12-17T12:00:00.000Z");

const schedule = [
  {
    number: 1,
    dueDate: new Date("2026-07-17T12:00:00.000Z"),
    principal: 521_435.00,
    interest: 178_565.00,
    totalAmount: 700_000.00,
    remainingBalance: 3_028_565.00,
  },
  {
    number: 2,
    dueDate: new Date("2026-08-17T12:00:00.000Z"),
    principal: 547_663.18,
    interest: 152_336.82,
    totalAmount: 700_000.00,
    remainingBalance: 2_480_901.82,
  },
  {
    number: 3,
    dueDate: new Date("2026-09-17T12:00:00.000Z"),
    principal: 575_210.64,
    interest: 124_789.36,
    totalAmount: 700_000.00,
    remainingBalance: 1_905_691.18,
  },
  {
    number: 4,
    dueDate: new Date("2026-10-17T12:00:00.000Z"),
    principal: 604_143.73,
    interest: 95_856.27,
    totalAmount: 700_000.00,
    remainingBalance: 1_301_547.45,
  },
  {
    number: 5,
    dueDate: new Date("2026-11-17T12:00:00.000Z"),
    principal: 634_532.16,
    interest: 65_467.84,
    totalAmount: 700_000.00,
    remainingBalance: 667_015.29,
  },
  {
    number: 6,
    dueDate: new Date("2026-12-17T12:00:00.000Z"),
    principal: 667_015.29,
    interest: 33_550.87,
    totalAmount: 700_566.16,
    remainingBalance: 0,
  },
];

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

  console.log("\nSchedule to insert:");
  for (const e of schedule) {
    console.log(
      `  #${e.number} | Due: ${e.dueDate.toISOString().slice(0, 10)} | Int: ${e.interest.toFixed(2)} | Prin: ${e.principal.toFixed(2)} | Total: ${e.totalAmount.toFixed(2)} | Bal: ${e.remainingBalance.toFixed(2)}`
    );
  }

  const totalInterest = schedule.reduce((s, e) => s + e.interest, 0);
  const totalPaid = schedule.reduce((s, e) => s + e.totalAmount, 0);
  console.log(`\nTotal intereses: ${totalInterest.toFixed(2)}`);
  console.log(`Total pagado: ${totalPaid.toFixed(2)}`);

  await db.transaction(async (tx) => {
    console.log("\nUpdating layaway header...");
    await tx
      .update(layaways)
      .set({
        type: "credito",
        totalAmount: toDbString(financedCapital),
        interestRate: interestRate.toFixed(4),
        financedCapital: toDbString(financedCapital),
        outstandingPrincipal: toDbString(financedCapital),
        termMonths,
        installmentAmount: toDbString(700_000),
        expiresAt: expiresDate,
        subStatus: "al_dia",
      })
      .where(eq(layaways.id, LAYAWAY_ID));

    console.log("Deleting existing schedule (if any)...");
    await tx.delete(layawaySchedule).where(eq(layawaySchedule.layawayId, LAYAWAY_ID));

    console.log("Inserting new schedule...");
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

  console.log(`\n✅ Isabel Guzman actualizada: 6 cuotas (5×700k + 1×700,566.16), tasa 5.03% mensual.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
