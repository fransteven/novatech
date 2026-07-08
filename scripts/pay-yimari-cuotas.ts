/**
 * scripts/pay-yimari-cuotas.ts
 *
 * Registra el pago histórico de las cuotas 1 y 2 del crédito de Yimari
 * (iPhone 17 Pro Max), replicando lo que hace registerCreditPayment()
 * en src/services/layaway-service.ts para type:"cuota":
 *   - cash_movements (direction: in, sourceType: layaway_payment)
 *   - layaway_payments (ledger, idempotente)
 *   - layaway_schedule -> status: pagada, paidAt
 *   - layaways.outstandingPrincipal (decrementado por el principal pagado)
 *
 * Cuota 1: pagada 2026-06-05, 930,000
 * Cuota 2: pagada 2026-06-26, 930,000
 * Cuenta: Lulo Bank Mireya (banco) -> paymentMethod "transfer"
 *
 * Run: npx tsx scripts/pay-yimari-cuotas.ts
 */

import "dotenv/config";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "../src/db";
import { layaways, layawaySchedule, layawayPayments, cashMovements } from "../src/db/schema";
import { toDbString } from "../src/lib/money";

const LAYAWAY_ID = "23eeed5c-96de-442f-bbec-34d6d92fddb0";
const ACCOUNT_ID = "21f77703-1c72-4322-8e45-3a07519f431a"; // Lulo Bank Mireya

const PAYMENTS = [
  { number: 1, date: new Date("2026-06-05T12:00:00.000Z") },
  { number: 2, date: new Date("2026-06-26T12:00:00.000Z") },
];

async function main() {
  console.log("Registrando pago de cuotas 1 y 2 para Yimari...");

  await db.transaction(async (tx) => {
    const [lay] = await tx
      .select()
      .from(layaways)
      .where(eq(layaways.id, LAYAWAY_ID))
      .limit(1);

    if (!lay) throw new Error(`Layaway ${LAYAWAY_ID} no encontrado.`);
    if (lay.type !== "credito") throw new Error("No es un crédito con interés.");
    if (lay.status !== "active") throw new Error(`Crédito no activo (status: ${lay.status}).`);

    const sched = await tx
      .select()
      .from(layawaySchedule)
      .where(
        and(
          eq(layawaySchedule.layawayId, LAYAWAY_ID),
          inArray(layawaySchedule.number, PAYMENTS.map((p) => p.number))
        )
      );

    let outstanding = Number(lay.outstandingPrincipal ?? lay.totalAmount);
    let lastRemainingBalance = outstanding;

    for (const p of PAYMENTS) {
      const cuota = sched.find((s) => s.number === p.number);
      if (!cuota) throw new Error(`Cuota ${p.number} no existe en el cronograma.`);
      if (cuota.status === "pagada") throw new Error(`La cuota ${p.number} ya está pagada.`);

      const principalPortion = Number(cuota.principal);
      const interestPortion = Number(cuota.interest);
      const amount = Number(cuota.totalAmount);

      console.log(
        `  Cuota ${p.number}: ${p.date.toISOString().slice(0, 10)} | monto ${amount.toFixed(2)} | prin ${principalPortion.toFixed(2)} | int ${interestPortion.toFixed(2)}`
      );

      const [cm] = await tx
        .insert(cashMovements)
        .values({
          accountId: ACCOUNT_ID,
          direction: "in",
          sourceType: "layaway_payment",
          sourceId: LAYAWAY_ID,
          paymentMethod: "transfer",
          amount: toDbString(amount),
          occurredAt: p.date,
          notes: `Pago cuota ${p.number} (registro histórico)`,
          status: "posted",
        })
        .returning();

      await tx.insert(layawayPayments).values({
        layawayId: LAYAWAY_ID,
        type: "cuota",
        amount: toDbString(amount),
        principalPortion: toDbString(principalPortion),
        interestPortion: toDbString(interestPortion),
        scheduleNumber: p.number,
        cashMovementId: cm.id,
        idempotencyKey: `hist_yimari_cuota_${p.number}`,
        createdAt: p.date,
      });

      await tx
        .update(layawaySchedule)
        .set({ status: "pagada", paidAt: p.date })
        .where(
          and(
            eq(layawaySchedule.layawayId, LAYAWAY_ID),
            eq(layawaySchedule.number, p.number)
          )
        );

      outstanding -= principalPortion;
      lastRemainingBalance = Number(cuota.remainingBalance);
    }

    console.log(`\nNuevo outstandingPrincipal: ${outstanding.toFixed(2)} (esperado: ${lastRemainingBalance.toFixed(2)})`);

    await tx
      .update(layaways)
      .set({
        outstandingPrincipal: toDbString(outstanding),
        subStatus: "al_dia",
      })
      .where(eq(layaways.id, LAYAWAY_ID));
  });

  console.log("\n✅ Cuotas 1 y 2 de Yimari registradas como pagadas.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
