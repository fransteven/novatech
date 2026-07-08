/**
 * scripts/update-doctor-cruz-layaway.ts
 *
 * Convierte el layaway de DOCTOR CRUZ (sin_interes) a crédito.
 * Dispositivo: Samsung S25 Ultra — costo: 3.750.000, precio venta: 4.200.000.
 * Vendido al costo; utilidad proviene exclusivamente de los intereses.
 *
 * Tasa: 5.89% mensual (0.0589) — obtenida resolviendo la anualidad
 *   PMT = P × r × (1+r)^n / ((1+r)^n − 1) ≈ 1.400.000
 *   para P = 3.750.000, n = 3. Mejor aproximación a 4 decimales.
 *   Interés por cuota = round(saldo × tasa). Última cuota cierra saldo.
 *
 * Cronograma (amortización francesa, redondeo COP):
 *   #1 — 2026-04-30 — 1.400.000,00  (int: 220.875,00  | cap: 1.179.125,00 | saldo: 2.570.875,00) PAGADA 30-04-2026
 *   #2 — 2026-05-30 — 1.400.000,00  (int: 151.425,00  | cap: 1.248.575,00 | saldo: 1.322.300,00) PAGADA 30-05-2026
 *   #3 — 2026-06-30 — 1.400.183,00  (int:  77.883,00  | cap: 1.322.300,00 | saldo:         0,00) PENDIENTE
 *
 * Total intereses: 450.183,00 COP
 * outstandingPrincipal al día de hoy: 1.322.300,00 COP
 *
 * Los 2 pagos históricos se registran en cashMovements (Efectivo Frank)
 * y en layawayPayments con createdAt = fecha real del pago (para que el
 * interés caiga en el mes correcto en profits-service).
 *
 * Run: npx tsx scripts/update-doctor-cruz-layaway.ts
 */

import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { layaways, layawaySchedule, layawayDetails, layawayPayments } from "../src/db/schema";
import { cashMovements } from "../src/db/schema/cash";
import { toDbString } from "../src/lib/money";

const CUSTOMER_NAME = "DOCTOR CRUZ";
const LAYAWAY_ID = "c8d86076-1f71-4d82-bbe9-b688f156bbfc";
const ACCOUNT_ID  = "4cb0bfcd-9f43-4ec1-8de7-b1e5cbbbff6a"; // Efectivo Frank

const financedCapital  = 3_750_000;
const interestRate     = 0.0589; // 5.89% mensual
const termMonths       = 3;
const installmentAmt   = 1_400_000;
const outstandingAfterTwo = 1_322_300; // saldo tras cuotas 1 y 2
const expiresDate = new Date("2026-06-30T12:00:00.000Z");

// Fechas reales de pago (en UTC noon para evitar drift de zona horaria)
const paidAt1 = new Date("2026-04-30T12:00:00.000Z");
const paidAt2 = new Date("2026-05-30T12:00:00.000Z");

const schedule = [
  {
    number: 1,
    dueDate: new Date("2026-04-30T12:00:00.000Z"),
    principal: 1_179_125.00,
    interest:    220_875.00,
    totalAmount: 1_400_000.00,
    remainingBalance: 2_570_875.00,
    status: "pagada" as const,
    paidAt: paidAt1,
  },
  {
    number: 2,
    dueDate: new Date("2026-05-30T12:00:00.000Z"),
    principal: 1_248_575.00,
    interest:    151_425.00,
    totalAmount: 1_400_000.00,
    remainingBalance: 1_322_300.00,
    status: "pagada" as const,
    paidAt: paidAt2,
  },
  {
    number: 3,
    dueDate: new Date("2026-06-30T12:00:00.000Z"),
    principal: 1_322_300.00,
    interest:     77_883.00,
    totalAmount: 1_400_183.00,
    remainingBalance: 0,
    status: "pendiente" as const,
    paidAt: null,
  },
];

// Pagos históricos (cuotas ya cobradas)
const historicalPayments = [
  {
    cuota: 1,
    principalPortion: 1_179_125.00,
    interestPortion:    220_875.00,
    paidAt: paidAt1,
    idempotencyKey: `hist_doctor_cruz_cuota_1`,
    notes: "Pago cuota 1 (registro histórico — recibido 30-04-2026)",
  },
  {
    cuota: 2,
    principalPortion: 1_248_575.00,
    interestPortion:    151_425.00,
    paidAt: paidAt2,
    idempotencyKey: `hist_doctor_cruz_cuota_2`,
    notes: "Pago cuota 2 (registro histórico — recibido 30-05-2026)",
  },
];

async function main() {
  console.log(`\n=== Actualizando layaway de ${CUSTOMER_NAME} ===\n`);

  // 1. Verificar que el layaway existe
  const [lay] = await db.select().from(layaways).where(eq(layaways.id, LAYAWAY_ID)).limit(1);
  if (!lay) {
    console.error(`❌ Layaway ${LAYAWAY_ID} no encontrado.`);
    process.exit(1);
  }
  console.log("Layaway encontrado:", {
    id: lay.id, type: lay.type, status: lay.status, totalAmount: lay.totalAmount,
  });

  // Preview del cronograma
  console.log("\nCronograma a insertar:");
  const totalInterest = schedule.reduce((s, e) => s + e.interest, 0);
  const totalPaid     = schedule.reduce((s, e) => s + e.totalAmount, 0);
  for (const e of schedule) {
    const paidStr = e.paidAt ? ` ← PAGADA ${e.paidAt.toISOString().slice(0, 10)}` : "";
    console.log(
      `  #${e.number} | ${e.dueDate.toISOString().slice(0, 10)} | int: ${e.interest.toFixed(2).padStart(10)} | cap: ${e.principal.toFixed(2).padStart(13)} | total: ${e.totalAmount.toFixed(2).padStart(12)} | saldo: ${e.remainingBalance.toFixed(2).padStart(12)}${paidStr}`
    );
  }
  console.log(`\nTotal intereses:       ${totalInterest.toFixed(2)}`);
  console.log(`Total a pagar:         ${totalPaid.toFixed(2)}`);
  console.log(`outstandingPrincipal:  ${outstandingAfterTwo.toFixed(2)}\n`);

  await db.transaction(async (tx) => {

    // 2. Actualizar cabecera del layaway
    console.log("→ Actualizando cabecera layaway...");
    await tx.update(layaways).set({
      type:                 "credito",
      totalAmount:          toDbString(financedCapital),
      interestRate:         interestRate.toFixed(4),
      financedCapital:      toDbString(financedCapital),
      outstandingPrincipal: toDbString(outstandingAfterTwo),
      termMonths,
      installmentAmount:    toDbString(installmentAmt),
      expiresAt:            expiresDate,
      subStatus:            "al_dia",
    }).where(eq(layaways.id, LAYAWAY_ID));

    // 3. Actualizar agreedPrice al costo (vendido al costo, utilidad = interés)
    console.log("→ Actualizando agreedPrice a costo (3.750.000)...");
    await tx.update(layawayDetails)
      .set({ agreedPrice: toDbString(financedCapital) })
      .where(eq(layawayDetails.layawayId, LAYAWAY_ID));

    // 4. Borrar cronograma viejo e insertar nuevo
    console.log("→ Eliminando cronograma existente (si hay)...");
    await tx.delete(layawaySchedule).where(eq(layawaySchedule.layawayId, LAYAWAY_ID));

    console.log("→ Insertando 3 cuotas en cronograma...");
    await tx.insert(layawaySchedule).values(
      schedule.map((e) => ({
        layawayId:        LAYAWAY_ID,
        number:           e.number,
        dueDate:          e.dueDate,
        principal:        toDbString(e.principal),
        interest:         toDbString(e.interest),
        totalAmount:      toDbString(e.totalAmount),
        remainingBalance: toDbString(e.remainingBalance),
        status:           e.status,
        paidAt:           e.paidAt ?? undefined,
      }))
    );

    // 5. Registrar pagos históricos (cashMovements + layawayPayments)
    for (const p of historicalPayments) {
      console.log(`→ Registrando movimiento de caja — cuota ${p.cuota}...`);
      const [cm] = await tx.insert(cashMovements).values({
        accountId:     ACCOUNT_ID,
        direction:     "in",
        amount:        toDbString(installmentAmt),
        sourceType:    "layaway_payment",
        sourceId:      LAYAWAY_ID,
        paymentMethod: "cash",
        occurredAt:    p.paidAt,
        createdAt:     p.paidAt,
        status:        "posted",
        notes:         p.notes,
        createdBy:     null,
      }).returning();

      console.log(`→ Registrando ledger layawayPayments — cuota ${p.cuota}...`);
      await tx.insert(layawayPayments).values({
        layawayId:        LAYAWAY_ID,
        type:             "cuota",
        amount:           toDbString(installmentAmt),
        principalPortion: toDbString(p.principalPortion),
        interestPortion:  toDbString(p.interestPortion),
        scheduleNumber:   p.cuota,
        cashMovementId:   cm.id,
        idempotencyKey:   p.idempotencyKey,
        createdBy:        null,
        createdAt:        p.paidAt,
      });
    }
  });

  console.log(`\n✅ ${CUSTOMER_NAME} actualizado:`);
  console.log(`   Crédito 3 cuotas × ~1.400.000, tasa 5.89% mensual.`);
  console.log(`   2 cuotas históricas registradas en caja (Efectivo Frank) y ledger.`);
  console.log(`   outstandingPrincipal: 1.322.300 COP`);
  console.log(`   Próxima cuota: #3 — 2026-06-30 — 1.400.183 COP\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
