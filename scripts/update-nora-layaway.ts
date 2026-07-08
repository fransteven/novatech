/**
 * scripts/update-nora-layaway.ts
 *
 * Converts Nora's layaway (sin_interes) to credit (credito).
 * iPhone 16 Pro sold at cost: 2,550,000 COP.
 * Financed capital = 2,550,000 COP.
 *
 * Interest rate: 2.95% monthly (0.0295) — best 4-decimal rate minimizing
 * last-installment deviation from 470,000 (diff = 363 COP).
 * Algorithm: declining balance, interest = round(balance * r) each period.
 *
 * Schedule (6 installments, last closes balance):
 *   #1 — 2026-07-05 — 470,000.00  (int: 75,225.00 | prin: 394,775.00 | bal: 2,155,225.00)
 *   #2 — 2026-08-05 — 470,000.00  (int: 63,579.00 | prin: 406,421.00 | bal: 1,748,804.00)
 *   #3 — 2026-09-05 — 470,000.00  (int: 51,590.00 | prin: 418,410.00 | bal: 1,330,394.00)
 *   #4 — 2026-10-05 — 470,000.00  (int: 39,247.00 | prin: 430,753.00 | bal:   899,641.00)
 *   #5 — 2026-11-05 — 470,000.00  (int: 26,539.00 | prin: 443,461.00 | bal:   456,180.00)
 *   #6 — 2026-12-05 — 469,637.00  (int: 13,457.00 | prin: 456,180.00 | bal:         0.00)
 *
 * Total intereses: 269,637.00 COP
 * Total pagado:  2,819,637.00 COP
 *
 * Also updates layawayDetails.agreedPrice 2,820,000 → 2,550,000.
 *
 * Run: npx tsx scripts/update-nora-layaway.ts
 */

import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { layaways, layawaySchedule, layawayDetails } from "../src/db/schema";
import { toDbString } from "../src/lib/money";

const CUSTOMER_NAME = "Nora";
const LAYAWAY_ID = "84bac1a9-a836-487b-8e5a-d4ed2deea148";

const financedCapital = 2_550_000;
const interestRate = 0.0295; // 2.95% mensual
const termMonths = 6;
const expiresDate = new Date("2026-12-05T12:00:00.000Z");

const schedule = [
  {
    number: 1,
    dueDate: new Date("2026-07-05T12:00:00.000Z"),
    principal: 394_775.00,
    interest:   75_225.00,
    totalAmount: 470_000.00,
    remainingBalance: 2_155_225.00,
  },
  {
    number: 2,
    dueDate: new Date("2026-08-05T12:00:00.000Z"),
    principal: 406_421.00,
    interest:   63_579.00,
    totalAmount: 470_000.00,
    remainingBalance: 1_748_804.00,
  },
  {
    number: 3,
    dueDate: new Date("2026-09-05T12:00:00.000Z"),
    principal: 418_410.00,
    interest:   51_590.00,
    totalAmount: 470_000.00,
    remainingBalance: 1_330_394.00,
  },
  {
    number: 4,
    dueDate: new Date("2026-10-05T12:00:00.000Z"),
    principal: 430_753.00,
    interest:   39_247.00,
    totalAmount: 470_000.00,
    remainingBalance: 899_641.00,
  },
  {
    number: 5,
    dueDate: new Date("2026-11-05T12:00:00.000Z"),
    principal: 443_461.00,
    interest:   26_539.00,
    totalAmount: 470_000.00,
    remainingBalance: 456_180.00,
  },
  {
    number: 6,
    dueDate: new Date("2026-12-05T12:00:00.000Z"),
    principal: 456_180.00,
    interest:   13_457.00,
    totalAmount: 469_637.00,
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
    console.log("\nUpdating layawayDetails.agreedPrice to 2,550,000...");
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
        installmentAmount: toDbString(470_000),
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
