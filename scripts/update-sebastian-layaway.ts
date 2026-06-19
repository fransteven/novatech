/**
 * scripts/update-sebastian-layaway.ts
 *
 * Updates the layaway for "Sebastian Aux CDO" to be a credit.
 * Financed capital is set to 5,000,000.00 (matching the cost of the phone, iPhone 17 Pro Max)
 * to satisfy the DB constraint (selling price cannot be less than purchase cost).
 * Interest rate is set to 2.25% (0.0225) monthly so that the monthly installments are
 * exactly 900,000 COP (with the last one adjusted to 901,110 COP to close the balance to 0).
 * Due dates start on July 1st, 2026, for 6 installments, with the credit starting June 1st, 2026.
 *
 * Run: npx tsx scripts/update-sebastian-layaway.ts
 */

import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { layaways, layawayDetails, layawaySchedule } from "../src/db/schema";
import { toDbString } from "../src/lib/money";

const CUSTOMER_NAME = "Sebastian Aux CDO";
const LAYAWAY_ID = "38fb48e4-c1d0-4e1b-8e45-25e7732fc25e";

async function main() {
  console.log(`Starting layaway update for ${CUSTOMER_NAME}...`);

  // 1. Fetch the layaway to confirm it exists
  const [lay] = await db
    .select()
    .from(layaways)
    .where(eq(layaways.id, LAYAWAY_ID))
    .limit(1);

  if (!lay) {
    console.error(`❌ Layaway with ID ${LAYAWAY_ID} not found.`);
    process.exit(1);
  }

  console.log(`Found layaway:`, lay);

  // 2. Manual Schedule Calculation with exact 900,000 cuotas (except last)
  const financedCapital = 5000000;
  const interestRate = 0.0225; // 2.25% monthly
  const termMonths = 6;
  const startDate = new Date("2026-06-01T12:00:00.000Z");
  const expiresDate = new Date("2026-12-01T12:00:00.000Z");

  console.log(`Generating manual schedule for capital: ${financedCapital}, rate: ${interestRate * 100}%, terms: ${termMonths}...`);
  
  const schedule = [
    { number: 1, dueDate: new Date("2026-07-01T12:00:00.000Z"), principal: 787500, interest: 112500, totalAmount: 900000, remainingBalance: 4212500 },
    { number: 2, dueDate: new Date("2026-08-01T12:00:00.000Z"), principal: 805219, interest: 94781, totalAmount: 900000, remainingBalance: 3407281 },
    { number: 3, dueDate: new Date("2026-09-01T12:00:00.000Z"), principal: 823336, interest: 76664, totalAmount: 900000, remainingBalance: 2583945 },
    { number: 4, dueDate: new Date("2026-10-01T12:00:00.000Z"), principal: 841861, interest: 58139, totalAmount: 900000, remainingBalance: 1742084 },
    { number: 5, dueDate: new Date("2026-11-01T12:00:00.000Z"), principal: 860803, interest: 39197, totalAmount: 900000, remainingBalance: 881281 },
    { number: 6, dueDate: new Date("2026-12-01T12:00:00.000Z"), principal: 881281, interest: 19829, totalAmount: 901110, remainingBalance: 0 },
  ];

  console.log("Generated manual schedule entries:");
  for (const entry of schedule) {
    console.log(
      `  Cuota #${entry.number} | Due: ${entry.dueDate.toISOString().slice(0, 10)} | Principal: ${entry.principal} | Interest: ${entry.interest} | Total: ${entry.totalAmount} | Balance: ${entry.remainingBalance}`
    );
  }

  // 3. Perform database updates
  await db.transaction(async (tx) => {
    // A. Update details agreed price to 5,000,000
    console.log("Updating layaway details agreed price...");
    await tx
      .update(layawayDetails)
      .set({ agreedPrice: toDbString(financedCapital) })
      .where(eq(layawayDetails.layawayId, LAYAWAY_ID));

    // B. Update layaway header
    console.log("Updating layaway header...");
    await tx
      .update(layaways)
      .set({
        type: "credito",
        totalAmount: toDbString(financedCapital),
        interestRate: interestRate.toString(), // Stores 0.0225 in Decimal(5,4)
        financedCapital: toDbString(financedCapital),
        outstandingPrincipal: toDbString(financedCapital),
        termMonths,
        installmentAmount: toDbString(900000), // Target installment amount is 900,000
        createdAt: startDate,
        expiresAt: expiresDate,
        subStatus: "al_dia",
      })
      .where(eq(layaways.id, LAYAWAY_ID));

    // C. Clean and insert schedule
    console.log("Cleaning old schedule and inserting new...");
    await tx.delete(layawaySchedule).where(eq(layawaySchedule.layawayId, LAYAWAY_ID));

    await tx.insert(layawaySchedule).values(
      schedule.map((entry) => ({
        layawayId: LAYAWAY_ID,
        number: entry.number,
        dueDate: entry.dueDate,
        principal: toDbString(entry.principal),
        interest: toDbString(entry.interest),
        totalAmount: toDbString(entry.totalAmount),
        remainingBalance: toDbString(entry.remainingBalance),
        status: "pendiente" as const,
      }))
    );
  });

  console.log(`\n✅ Layaway updated successfully with exact 900k installments!`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error running script:", err);
  process.exit(1);
});
