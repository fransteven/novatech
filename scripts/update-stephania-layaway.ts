/**
 * scripts/update-stephania-layaway.ts
 *
 * Converts Stephania Cardenas's layaway (sin_interes) to credit (credito).
 * Samsung S26 Ultra 512GB sold at cost: 4,450,000 COP.
 * Financed capital = 4,450,000 COP.
 *
 * Interest rate: 3.79% monthly (0.0379) — best 4-decimal rate minimizing
 * last-installment deviation from 1,220,000 (diff = -554 COP).
 * Algorithm: declining balance, interest = round(balance * r) each period.
 *
 * Schedule (4 installments, last closes balance):
 *   #1 — 2026-07-05 — 1,220,000.00  (int: 168,655.00 | prin: 1,051,345.00 | bal: 3,398,655.00)
 *   #2 — 2026-08-05 — 1,220,000.00  (int: 128,809.00 | prin: 1,091,191.00 | bal: 2,307,464.00)
 *   #3 — 2026-09-05 — 1,220,000.00  (int:  87,453.00 | prin: 1,132,547.00 | bal: 1,174,917.00)
 *   #4 — 2026-10-05 — 1,219,446.00  (int:  44,529.00 | prin: 1,174,917.00 | bal:         0.00)
 *
 * Total intereses: 429,446.00 COP
 * Total pagado:  4,879,446.00 COP
 *
 * Also updates layawayDetails.agreedPrice 4,880,000 → 4,450,000.
 *
 * Run: npx tsx scripts/update-stephania-layaway.ts
 */

import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { layaways, layawaySchedule, layawayDetails } from "../src/db/schema";
import { toDbString } from "../src/lib/money";

const CUSTOMER_NAME = "Stephania Cardenas";
const LAYAWAY_ID = "0ad614f8-9efd-447f-9128-76582418985f";

const financedCapital = 4_450_000;
const interestRate = 0.0379; // 3.79% mensual
const termMonths = 4;
const expiresDate = new Date("2026-10-05T12:00:00.000Z");

const schedule = [
  {
    number: 1,
    dueDate: new Date("2026-07-05T12:00:00.000Z"),
    principal: 1_051_345.00,
    interest:    168_655.00,
    totalAmount: 1_220_000.00,
    remainingBalance: 3_398_655.00,
  },
  {
    number: 2,
    dueDate: new Date("2026-08-05T12:00:00.000Z"),
    principal: 1_091_191.00,
    interest:    128_809.00,
    totalAmount: 1_220_000.00,
    remainingBalance: 2_307_464.00,
  },
  {
    number: 3,
    dueDate: new Date("2026-09-05T12:00:00.000Z"),
    principal: 1_132_547.00,
    interest:     87_453.00,
    totalAmount: 1_220_000.00,
    remainingBalance: 1_174_917.00,
  },
  {
    number: 4,
    dueDate: new Date("2026-10-05T12:00:00.000Z"),
    principal: 1_174_917.00,
    interest:     44_529.00,
    totalAmount: 1_219_446.00,
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
  console.log(`Total pagado:    ${totalPaid.toFixed(2)}`);

  await db.transaction(async (tx) => {
    console.log("\nUpdating layawayDetails.agreedPrice to 4,450,000...");
    await tx
      .update(layawayDetails)
      .set({ agreedPrice: toDbString(financedCapital) })
      .where(eq(layawayDetails.layawayId, LAYAWAY_ID));

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
        installmentAmount: toDbString(1_220_000),
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

  console.log(`\n✅ ${CUSTOMER_NAME} actualizada con éxito.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
