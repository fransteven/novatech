/**
 * scripts/convert-sebastian-to-apartado.ts
 *
 * Revierte el crédito de "Sebastian Aux CDO" (creado por
 * update-sebastian-layaway.ts) de vuelta a un apartado sin interés.
 *
 * Equipo vendido en 5,400,000 COP. Cliente ya abonó 1,400,000 COP
 * (Lulo Bank Mireya, transferencia, 2026-06-01). Saldo pendiente: 4,000,000 COP.
 *
 * Run: npx tsx scripts/convert-sebastian-to-apartado.ts
 */

import "dotenv/config";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../src/db";
import {
  layaways,
  layawayDetails,
  layawaySchedule,
  layawayPayments,
} from "../src/db/schema";
import { cashMovements } from "../src/db/schema/cash";
import { toDbString } from "../src/lib/money";

const CUSTOMER_NAME = "Sebastian Aux CDO";
const LAYAWAY_ID = "38fb48e4-c1d0-4e1b-8e45-25e7732fc25e";
const ACCOUNT_ID = "21f77703-1c72-4322-8e45-3a07519f431a"; // Lulo Bank Mireya

const TOTAL_AMOUNT = 5_400_000;
const INITIAL_DEPOSIT = 1_400_000;
const DEPOSIT_DATE = new Date("2026-06-01T12:00:00.000Z");
const EXPIRES_AT = new Date("2026-12-01T12:00:00.000Z");

async function main() {
  console.log(`Starting credit -> apartado conversion for ${CUSTOMER_NAME}...`);

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

  await db.transaction(async (tx) => {
    console.log("Updating layaway_details.agreedPrice...");
    await tx
      .update(layawayDetails)
      .set({ agreedPrice: toDbString(TOTAL_AMOUNT) })
      .where(eq(layawayDetails.layawayId, LAYAWAY_ID));

    console.log("Updating layaway header to sin_interes...");
    await tx
      .update(layaways)
      .set({
        type: "sin_interes",
        status: "active",
        subStatus: null,
        totalAmount: toDbString(TOTAL_AMOUNT),
        interestRate: null,
        financedCapital: null,
        outstandingPrincipal: null,
        termMonths: null,
        installmentAmount: null,
        expiresAt: EXPIRES_AT,
      })
      .where(eq(layaways.id, LAYAWAY_ID));

    console.log("Deleting credit schedule...");
    await tx.delete(layawaySchedule).where(eq(layawaySchedule.layawayId, LAYAWAY_ID));

    console.log("Deleting credit payment ledger rows (idempotency)...");
    await tx.delete(layawayPayments).where(eq(layawayPayments.layawayId, LAYAWAY_ID));

    console.log("Clearing prior cash movements for this layaway (idempotency)...");
    await tx
      .delete(cashMovements)
      .where(
        and(
          eq(cashMovements.sourceId, LAYAWAY_ID),
          sql`${cashMovements.sourceType} IN ('layaway_deposit', 'layaway_payment')`
        )
      );

    console.log("Inserting initial deposit cash movement...");
    await tx.insert(cashMovements).values({
      accountId: ACCOUNT_ID,
      direction: "in",
      sourceType: "layaway_deposit",
      sourceId: LAYAWAY_ID,
      paymentMethod: "transfer",
      amount: toDbString(INITIAL_DEPOSIT),
      occurredAt: DEPOSIT_DATE,
      notes: "Abono inicial apartado",
      createdBy: null,
      status: "posted",
    });
  });

  console.log(
    `\n✅ ${CUSTOMER_NAME} convertido a apartado sin interés: total 5,400,000 | abonado 1,400,000 | saldo 4,000,000.`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
