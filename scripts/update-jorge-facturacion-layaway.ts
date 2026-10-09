/**
 * scripts/update-jorge-facturacion-layaway.ts
 *
 * Ajusta el crédito 76a7591b (Jorge Facturacion): la cuota inicial real fue
 * 1,500,000 (antes 1,000,000), así que el capital financiado baja de
 * 1,429,000 a 929,000 y queda en 6 cuotas de 178,000.
 *
 * Tasa: anualidad PMT = 178,000 para P = 929,000, n = 6 → 4.13544% mensual
 * (se guarda 0.0414). El cronograma usa la tasa exacta y la cuota #6 absorbe
 * el redondeo para cerrar en 178,000.
 *
 * Total intereses: 139,000 COP · Total cuotas: 1,068,000 COP
 * Se conservan las fechas de vencimiento existentes.
 *
 * Run: npx tsx scripts/update-jorge-facturacion-layaway.ts
 */

import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { layaways, layawaySchedule, layawayPayments, cashMovements } from "../src/db/schema";
import { toDbString } from "../src/lib/money";

const LAYAWAY_ID = "76a7591b-5958-4ce6-85da-4ad762257724";
const INITIAL_PAYMENT_ID = "0a3f75ce-a1bf-4f9e-9f18-808998b841bc";
const INITIAL_CASH_MOVEMENT_ID = "ea300326-5671-4566-a82f-30584bfa65b2";

const downPayment = 1500000;
const financedCapital = 929000;
const interestRate = 0.0414;
const termMonths = 6;
const installmentAmount = 178000;

const rows = [
  { number: 1, principal: 139582, interest: 38418, remainingBalance: 789418 },
  { number: 2, principal: 145354, interest: 32646, remainingBalance: 644064 },
  { number: 3, principal: 151365, interest: 26635, remainingBalance: 492699 },
  { number: 4, principal: 157625, interest: 20375, remainingBalance: 335074 },
  { number: 5, principal: 164143, interest: 13857, remainingBalance: 170931 },
  { number: 6, principal: 170931, interest: 7069, remainingBalance: 0 },
];

async function main() {
  const [lay] = await db.select().from(layaways).where(eq(layaways.id, LAYAWAY_ID)).limit(1);
  if (!lay) throw new Error("Layaway not found");

  const oldSchedule = await db
    .select()
    .from(layawaySchedule)
    .where(eq(layawaySchedule.layawayId, LAYAWAY_ID))
    .orderBy(layawaySchedule.number);
  if (oldSchedule.length !== termMonths) throw new Error("Unexpected schedule length");
  if (oldSchedule.some((s) => s.status !== "pendiente" || Number(s.paidAmount ?? 0) > 0)) {
    throw new Error("Schedule already has payments; aborting");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(cashMovements)
      .set({ amount: toDbString(downPayment) })
      .where(eq(cashMovements.id, INITIAL_CASH_MOVEMENT_ID));

    await tx
      .update(layawayPayments)
      .set({ amount: toDbString(downPayment), principalPortion: toDbString(downPayment) })
      .where(eq(layawayPayments.id, INITIAL_PAYMENT_ID));

    await tx
      .update(layaways)
      .set({
        interestRate: interestRate.toFixed(4),
        financedCapital: toDbString(financedCapital),
        outstandingPrincipal: toDbString(financedCapital),
        termMonths,
        installmentAmount: toDbString(installmentAmount),
      })
      .where(eq(layaways.id, LAYAWAY_ID));

    await tx.delete(layawaySchedule).where(eq(layawaySchedule.layawayId, LAYAWAY_ID));
    await tx.insert(layawaySchedule).values(
      rows.map((r) => ({
        layawayId: LAYAWAY_ID,
        number: r.number,
        dueDate: oldSchedule[r.number - 1].dueDate,
        principal: toDbString(r.principal),
        interest: toDbString(r.interest),
        totalAmount: toDbString(installmentAmount),
        remainingBalance: toDbString(r.remainingBalance),
        status: "pendiente" as const,
      }))
    );
  });

  console.log("✅ Crédito ajustado: inicial 1,500,000 · 6 cuotas de 178,000");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
