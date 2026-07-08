/**
 * scripts/update-carla-layaway.ts
 *
 * Actualiza el crédito de Carla Herrera (IMEI 013854006560167) a las nuevas
 * condiciones acordadas: 5 cuotas de 740,000 (antes 6 cuotas de 613,000),
 * capital financiado sin cambio (3,220,000, costo del equipo).
 *
 * Tasa: 4.82% mensual — derivada de resolver la anualidad
 * PMT = P × r × (1+r)^n / ((1+r)^n − 1) = 740,000 para P=3,220,000, n=5.
 * Exacta ≈ 4.81795% → redondeada a 4 dp: 0.0482.
 *
 * Cronograma (francés, cuota forzada a 740,000, la última cierra el saldo):
 *   #1 — 2026-07-01 — 740,000.00   (int: 155,204.00 | prin: 584,796.00 | bal: 2,635,204.00)
 *   #2 — 2026-08-01 — 740,000.00   (int: 127,017.00 | prin: 612,983.00 | bal: 2,022,221.00)
 *   #3 — 2026-09-01 — 740,000.00   (int:  97,471.00 | prin: 642,529.00 | bal: 1,379,692.00)
 *   #4 — 2026-10-01 — 740,000.00   (int:  66,501.00 | prin: 673,499.00 | bal:   706,193.00)
 *   #5 — 2026-11-01 — 740,000.00   (int:  33,807.00 | prin: 706,193.00 | bal:         0.00)
 *
 * Total intereses: 480,000.00 COP
 * Total pagado:    3,700,000.00 COP
 *
 * Además registra el pago histórico de la cuota #1 (pagada 2026-07-01,
 * Lulo Bank Mireya, transferencia), replicando registerCreditPayment()
 * de src/services/layaway-service.ts para type:"cuota" pero con fecha
 * retroactiva (la función de servicio siempre usa la fecha actual).
 *
 * Run: npx tsx scripts/update-carla-layaway.ts
 */

import "dotenv/config";
import { eq, and } from "drizzle-orm";
import { db } from "../src/db";
import {
  layaways,
  layawaySchedule,
  layawayDetails,
  layawayPayments,
  cashMovements,
} from "../src/db/schema";
import { toDbString } from "../src/lib/money";

const CUSTOMER_NAME = "Carla Herrera";
const LAYAWAY_ID = "425617dd-b259-4835-96bf-146dec514c3f";
const ACCOUNT_ID = "21f77703-1c72-4322-8e45-3a07519f431a"; // Lulo Bank Mireya

const financedCapital = 3220000;
const interestRate = 0.0482; // 4.82% mensual
const termMonths = 5;
const installmentAmount = 740000;
const expiresDate = new Date("2026-11-01T12:00:00.000Z");

const schedule = [
  {
    number: 1,
    dueDate: new Date("2026-07-01T12:00:00.000Z"),
    principal: 584796.0,
    interest: 155204.0,
    totalAmount: 740000.0,
    remainingBalance: 2635204.0,
  },
  {
    number: 2,
    dueDate: new Date("2026-08-01T12:00:00.000Z"),
    principal: 612983.0,
    interest: 127017.0,
    totalAmount: 740000.0,
    remainingBalance: 2022221.0,
  },
  {
    number: 3,
    dueDate: new Date("2026-09-01T12:00:00.000Z"),
    principal: 642529.0,
    interest: 97471.0,
    totalAmount: 740000.0,
    remainingBalance: 1379692.0,
  },
  {
    number: 4,
    dueDate: new Date("2026-10-01T12:00:00.000Z"),
    principal: 673499.0,
    interest: 66501.0,
    totalAmount: 740000.0,
    remainingBalance: 706193.0,
  },
  {
    number: 5,
    dueDate: new Date("2026-11-01T12:00:00.000Z"),
    principal: 706193.0,
    interest: 33807.0,
    totalAmount: 740000.0,
    remainingBalance: 0,
  },
];

const PAYMENT = {
  number: 1,
  date: new Date("2026-07-01T12:00:00.000Z"),
};

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
    console.log("\nUpdating layaway_details.agreedPrice (sin cambio, 3,220,000)...");
    await tx
      .update(layawayDetails)
      .set({ agreedPrice: toDbString(financedCapital) })
      .where(eq(layawayDetails.layawayId, LAYAWAY_ID));

    console.log("Updating layaway header (5 cuotas de 740,000)...");
    await tx
      .update(layaways)
      .set({
        type: "credito",
        totalAmount: toDbString(financedCapital),
        interestRate: interestRate.toFixed(4),
        financedCapital: toDbString(financedCapital),
        outstandingPrincipal: toDbString(financedCapital),
        termMonths,
        installmentAmount: toDbString(installmentAmount),
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

    // --- Registrar pago histórico de la cuota #1 (pagada 2026-07-01) ---
    const cuota1 = schedule.find((e) => e.number === PAYMENT.number)!;

    console.log(
      `\nRegistrando pago histórico cuota ${PAYMENT.number}: ${PAYMENT.date.toISOString().slice(0, 10)} | monto ${cuota1.totalAmount.toFixed(2)} | prin ${cuota1.principal.toFixed(2)} | int ${cuota1.interest.toFixed(2)}`
    );

    const [cm] = await tx
      .insert(cashMovements)
      .values({
        accountId: ACCOUNT_ID,
        direction: "in",
        sourceType: "layaway_payment",
        sourceId: LAYAWAY_ID,
        paymentMethod: "transfer",
        amount: toDbString(cuota1.totalAmount),
        occurredAt: PAYMENT.date,
        notes: `Pago cuota ${PAYMENT.number} (registro histórico)`,
        status: "posted",
      })
      .returning();

    await tx.insert(layawayPayments).values({
      layawayId: LAYAWAY_ID,
      type: "cuota",
      amount: toDbString(cuota1.totalAmount),
      principalPortion: toDbString(cuota1.principal),
      interestPortion: toDbString(cuota1.interest),
      scheduleNumber: PAYMENT.number,
      cashMovementId: cm.id,
      idempotencyKey: "hist_carla_cuota_1",
      createdAt: PAYMENT.date,
    });

    await tx
      .update(layawaySchedule)
      .set({ status: "pagada", paidAt: PAYMENT.date })
      .where(
        and(
          eq(layawaySchedule.layawayId, LAYAWAY_ID),
          eq(layawaySchedule.number, PAYMENT.number)
        )
      );

    const outstanding = financedCapital - cuota1.principal;
    console.log(`Nuevo outstandingPrincipal: ${outstanding.toFixed(2)} (esperado: ${cuota1.remainingBalance.toFixed(2)})`);

    await tx
      .update(layaways)
      .set({
        outstandingPrincipal: toDbString(outstanding),
        subStatus: "al_dia",
      })
      .where(eq(layaways.id, LAYAWAY_ID));
  });

  console.log(`\n✅ Carla Herrera actualizada con éxito (5 cuotas de 740,000, cuota #1 pagada).`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
