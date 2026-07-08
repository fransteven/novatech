/**
 * scripts/update-yimari-layaway.ts
 *
 * Converts Yimari's layaway (sin_interes) to a credit (credito).
 * Device: iPhone 17 Pro Max Silver. Sold at cost: 4,600,000 COP.
 * Profit from interest only.
 *
 * Interest rate: 5.81% monthly (0.0581) — derived by solving the annuity
 * formula PMT = P × r × (1+r)^n / ((1+r)^n − 1) = 930,000
 * for P=4,600,000, n=6. Exact rate ≈ 5.813% → rounded to 4 dp: 0.0581.
 *
 * Schedule (French amortization, cuotas 1-5 = 930,000, cuota 6 closes balance):
 *   #1 — 2026-07-05 — 930,000.00   (int: 267,260.00  | prin: 662,740.00   | bal: 3,937,260.00)
 *   #2 — 2026-08-05 — 930,000.00   (int: 228,754.81  | prin: 701,245.19   | bal: 3,236,014.81)
 *   #3 — 2026-09-05 — 930,000.00   (int: 188,012.46  | prin: 741,987.54   | bal: 2,494,027.27)
 *   #4 — 2026-10-05 — 930,000.00   (int: 144,902.98  | prin: 785,097.02   | bal: 1,708,930.25)
 *   #5 — 2026-11-05 — 930,000.00   (int:  99,288.84  | prin: 830,711.16   | bal:   878,219.09)
 *   #6 — 2026-12-05 — 929,243.61   (int:  51,024.52  | prin: 878,219.09   | bal:         0.00)
 *
 * Total intereses: 979,243.61 COP
 * Total pagado:  5,579,243.61 COP
 *
 * Also updates layaway_details.agreedPrice from 5,700,000 → 4,600,000 (at-cost sale).
 *
 * Run: npx tsx scripts/update-yimari-layaway.ts
 */

import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { layaways, layawaySchedule, layawayDetails } from "../src/db/schema";
import { toDbString } from "../src/lib/money";

const CUSTOMER_NAME = "Yimari";
const LAYAWAY_ID = "23eeed5c-96de-442f-bbec-34d6d92fddb0";

const financedCapital = 4_600_000;
const interestRate = 0.0581; // 5.81% mensual
const termMonths = 6;
const expiresDate = new Date("2026-12-05T12:00:00.000Z");

const schedule = [
  {
    number: 1,
    dueDate: new Date("2026-07-05T12:00:00.000Z"),
    principal: 662_740.00,
    interest: 267_260.00,
    totalAmount: 930_000.00,
    remainingBalance: 3_937_260.00,
  },
  {
    number: 2,
    dueDate: new Date("2026-08-05T12:00:00.000Z"),
    principal: 701_245.19,
    interest: 228_754.81,
    totalAmount: 930_000.00,
    remainingBalance: 3_236_014.81,
  },
  {
    number: 3,
    dueDate: new Date("2026-09-05T12:00:00.000Z"),
    principal: 741_987.54,
    interest: 188_012.46,
    totalAmount: 930_000.00,
    remainingBalance: 2_494_027.27,
  },
  {
    number: 4,
    dueDate: new Date("2026-10-05T12:00:00.000Z"),
    principal: 785_097.02,
    interest: 144_902.98,
    totalAmount: 930_000.00,
    remainingBalance: 1_708_930.25,
  },
  {
    number: 5,
    dueDate: new Date("2026-11-05T12:00:00.000Z"),
    principal: 830_711.16,
    interest: 99_288.84,
    totalAmount: 930_000.00,
    remainingBalance: 878_219.09,
  },
  {
    number: 6,
    dueDate: new Date("2026-12-05T12:00:00.000Z"),
    principal: 878_219.09,
    interest: 51_024.52,
    totalAmount: 929_243.61,
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
    console.log("\nUpdating layaway_details.agreedPrice to cost (4,600,000)...");
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
        installmentAmount: toDbString(930_000),
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

  console.log(`\n✅ Yimari actualizada: 6 cuotas (5×930k + 1×929,243.61), tasa 5.81% mensual, capital 4,600,000.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
