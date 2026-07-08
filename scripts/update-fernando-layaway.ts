/**
 * scripts/update-fernando-layaway.ts (v3)
 *
 * Converts Fernando's layaway to a 0%-interest credit (credito) for the full
 * sale price of 2,300,000 COP — cuota inicial + 4 cuotas de 375,000:
 *
 *   Cuota 1 — 2026-06-05 — 800,000  (PAGADA — cuota inicial)
 *   Cuota 2 — 2026-07-01 — 375,000  (PAGADA)
 *   Cuota 3 — 2026-08-01 — 375,000  (pendiente)
 *   Cuota 4 — 2026-09-01 — 375,000  (pendiente)
 *   Cuota 5 — 2026-10-01 — 375,000  (pendiente)
 *
 *   Total: 2,300,000 COP  |  Interés: 0 COP  |  Tasa: 0%
 *
 * Utilidad del negocio = venta (2,300,000) − costo (2,020,000) = 280,000 COP
 * (margen de venta, no interés financiero de cuotas).
 *
 * Also cleans up any previous run's records (schedule + payments + cash movements).
 *
 * Run: npx tsx scripts/update-fernando-layaway.ts
 */

import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { layaways, layawaySchedule, layawayPayments } from "../src/db/schema";
import { cashMovements } from "../src/db/schema/cash";
import { toDbString } from "../src/lib/money";

const CUSTOMER_NAME = "Fernando";
const LAYAWAY_ID = "d689c271-73fe-447a-a49d-b051abb5402c";
const ACCOUNT_ID = "4cb0bfcd-9f43-4ec1-8de7-b1e5cbbbff6a"; // Efectivo Frank

const financedCapital = 2_300_000;
const outstandingPrincipal = 1_125_000; // 2,300,000 − 800,000 (inicial) − 375,000 (cuota #2 pagada)
const expiresDate = new Date("2026-10-01T12:00:00.000Z");
const initialPaidAt = new Date("2026-06-05T12:00:00.000Z");
const cuota2PaidAt = new Date("2026-07-01T12:00:00.000Z");

const schedule = [
  {
    number: 1,
    dueDate: new Date("2026-06-05T12:00:00.000Z"),
    principal: 800_000,
    interest: 0,
    totalAmount: 800_000,
    remainingBalance: 1_500_000,
    status: "pagada" as const,
    paidAt: new Date("2026-06-05T12:00:00.000Z"),
  },
  {
    number: 2,
    dueDate: new Date("2026-07-01T12:00:00.000Z"),
    principal: 375_000,
    interest: 0,
    totalAmount: 375_000,
    remainingBalance: 1_125_000,
    status: "pagada" as const,
    paidAt: cuota2PaidAt,
  },
  {
    number: 3,
    dueDate: new Date("2026-08-01T12:00:00.000Z"),
    principal: 375_000,
    interest: 0,
    totalAmount: 375_000,
    remainingBalance: 750_000,
    status: "pendiente" as const,
    paidAt: undefined,
  },
  {
    number: 4,
    dueDate: new Date("2026-09-01T12:00:00.000Z"),
    principal: 375_000,
    interest: 0,
    totalAmount: 375_000,
    remainingBalance: 375_000,
    status: "pendiente" as const,
    paidAt: undefined,
  },
  {
    number: 5,
    dueDate: new Date("2026-10-01T12:00:00.000Z"),
    principal: 375_000,
    interest: 0,
    totalAmount: 375_000,
    remainingBalance: 0,
    status: "pendiente" as const,
    paidAt: undefined,
  },
];

async function main() {
  console.log(`Starting layaway update (v2) for ${CUSTOMER_NAME}...`);

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

  // Gather existing payments to clean up (need their cashMovementIds)
  const existingPayments = await db
    .select({ id: layawayPayments.id, cashMovementId: layawayPayments.cashMovementId })
    .from(layawayPayments)
    .where(eq(layawayPayments.layawayId, LAYAWAY_ID));

  console.log(`Found ${existingPayments.length} existing payment(s) to clean up.`);

  await db.transaction(async (tx) => {
    // 1. Delete previous payment ledger entries (from v1 run)
    if (existingPayments.length > 0) {
      console.log("1. Removing old payment ledger entries...");
      await tx.delete(layawayPayments).where(eq(layawayPayments.layawayId, LAYAWAY_ID));

      // Delete associated cash movements
      for (const p of existingPayments) {
        if (p.cashMovementId) {
          await tx.delete(cashMovements).where(eq(cashMovements.id, p.cashMovementId));
        }
      }
    }

    // 2. Delete old schedule (v1: 3 cuotas at 11.09%)
    console.log("2. Removing old schedule...");
    await tx.delete(layawaySchedule).where(eq(layawaySchedule.layawayId, LAYAWAY_ID));

    // 3. Update layaway header
    console.log("3. Updating layaway header (2,300,000 / 0% / inicial + 4 cuotas de 375,000)...");
    await tx
      .update(layaways)
      .set({
        type: "credito",
        totalAmount: toDbString(financedCapital),
        interestRate: (0).toFixed(4),            // 0.0000
        financedCapital: toDbString(financedCapital),
        outstandingPrincipal: toDbString(outstandingPrincipal),
        termMonths: 4,
        installmentAmount: toDbString(375_000),
        expiresAt: expiresDate,
        subStatus: "al_dia",
      })
      .where(eq(layaways.id, LAYAWAY_ID));

    // agreedPrice stays at 2,300,000 (layawayDetails untouched)

    // 4. Insert new schedule (inicial + 4 cuotas de 375,000, 0% interest)
    console.log("4. Inserting new schedule (inicial + 4 cuotas de 375,000, 0% interest)...");
    await tx.insert(layawaySchedule).values(
      schedule.map((e) => ({
        layawayId: LAYAWAY_ID,
        number: e.number,
        dueDate: e.dueDate,
        principal: toDbString(e.principal),
        interest: toDbString(e.interest),
        totalAmount: toDbString(e.totalAmount),
        remainingBalance: toDbString(e.remainingBalance),
        status: e.status,
        paidAt: e.paidAt ?? undefined,
      }))
    );

    // 5. Register the paid initial cuota (800,000) in cashMovements + layawayPayments
    console.log("5. Registering cuota inicial 800,000 as cuota #1 paid...");
    const [cm] = await tx
      .insert(cashMovements)
      .values({
        accountId: ACCOUNT_ID,
        direction: "in",
        amount: toDbString(800_000),
        sourceType: "layaway_payment",
        sourceId: LAYAWAY_ID,
        paymentMethod: "cash",
        occurredAt: initialPaidAt,
        createdAt: initialPaidAt,
        status: "posted",
        notes: "Cuota #1 (inicial) iPhone 14 Pro Max — Fernando (registro histórico)",
        createdBy: null,
      })
      .returning();

    await tx.insert(layawayPayments).values({
      layawayId: LAYAWAY_ID,
      type: "cuota",
      amount: toDbString(800_000),
      principalPortion: toDbString(800_000),
      interestPortion: toDbString(0),
      scheduleNumber: 1,
      capitalStrategy: null,
      cashMovementId: cm.id,
      idempotencyKey: "hist_fernando_cuota_1",
      createdBy: null,
      createdAt: initialPaidAt,
    });

    // 6. Register cuota #2 (375,000) as paid on 2026-07-01
    console.log("6. Registrando cuota #2 (375,000) pagada el 1 jul 2026...");
    const [cm2] = await tx
      .insert(cashMovements)
      .values({
        accountId: ACCOUNT_ID,
        direction: "in",
        amount: toDbString(375_000),
        sourceType: "layaway_payment",
        sourceId: LAYAWAY_ID,
        paymentMethod: "cash",
        occurredAt: cuota2PaidAt,
        createdAt: cuota2PaidAt,
        status: "posted",
        notes: "Cuota #2 iPhone 14 Pro Max — Fernando (registro histórico)",
        createdBy: null,
      })
      .returning();

    await tx.insert(layawayPayments).values({
      layawayId: LAYAWAY_ID,
      type: "cuota",
      amount: toDbString(375_000),
      principalPortion: toDbString(375_000),
      interestPortion: toDbString(0),
      scheduleNumber: 2,
      capitalStrategy: null,
      cashMovementId: cm2.id,
      idempotencyKey: "hist_fernando_cuota_2",
      createdBy: null,
      createdAt: cuota2PaidAt,
    });
  });

  console.log(`\n✅ ${CUSTOMER_NAME} actualizado (v3):`);
  console.log(`   Crédito 0% — #1 = 800,000 (pagada, inicial) + #2,3,4,5 = 375,000 cada una (#2 pagada).`);
  console.log(`   financedCapital: 2,300,000 COP`);
  console.log(`   outstandingPrincipal: 1,125,000 COP (pendiente)`);
  console.log(`   Utilidad del negocio: 2,300,000 − 2,020,000 = 280,000 COP (margen de venta)`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
