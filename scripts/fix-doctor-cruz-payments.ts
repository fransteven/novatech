/**
 * scripts/fix-doctor-cruz-payments.ts
 *
 * Elimina los 2 cash_movements residuales (layaway_deposit del 2026-06-04) que
 * quedaron del layaway sin_interes original del doctor cruz antes de convertirlo
 * a crédito.  Esos 2 depósitos inflan totalPaid (4 × 1.400.000 = 5.600.000 >
 * total 3.750.000), hacen que balance sea negativo, y la UI muestra "completado"
 * aunque el crédito sigue activo con la cuota 3 pendiente (2026-06-30).
 *
 * Cambios:
 *   - Borra exactamente 2 cash_movements con source_type='layaway_deposit'
 *     del layaway del doctor cruz.
 *   - No toca layaway_payments (ya tiene solo los 2 correctos).
 *   - No toca layaway_schedule (cuota 3 permanece pendiente).
 *   - No toca layaways.status (ya es 'active' en DB).
 *
 * Resultado esperado:
 *   - Registro de pagos: 2 movimientos (cuotas 30-04 y 30-05).
 *   - Balance: 3.750.000 − 2.800.000 = 950.000 COP → UI muestra 'active'.
 *
 * Run: npx tsx scripts/fix-doctor-cruz-payments.ts
 */

import "dotenv/config";
import { and, eq, inArray, sql } from "drizzle-orm";
import { ilike } from "drizzle-orm";
import { db } from "../src/db";
import { layaways } from "../src/db/schema";
import { customers } from "../src/db/schema/customers";
import { cashMovements } from "../src/db/schema/cash";

async function main() {
  console.log("\n=== fix-doctor-cruz-payments ===\n");

  // 1. Resolver layawayId por nombre del cliente (no hardcodear)
  const rows = await db
    .select({ layawayId: layaways.id, customerName: customers.name, status: layaways.status, totalAmount: layaways.totalAmount })
    .from(layaways)
    .innerJoin(customers, eq(layaways.customerId, customers.id))
    .where(ilike(customers.name, "%cruz%"));

  if (rows.length === 0) {
    console.error("❌ No se encontró ningún layaway para cliente con 'cruz'.");
    process.exit(1);
  }
  if (rows.length > 1) {
    console.error(`❌ Se encontraron ${rows.length} layaways con 'cruz'. Especificar más.`);
    for (const r of rows) console.error("  ", r);
    process.exit(1);
  }

  const { layawayId, customerName, status, totalAmount } = rows[0];
  console.log(`Cliente: ${customerName}`);
  console.log(`Layaway: ${layawayId}`);
  console.log(`Status en DB: ${status} | Total: ${totalAmount}\n`);

  // 2. Auditar movimientos actuales
  const before = await db
    .select({
      id: cashMovements.id,
      sourceType: cashMovements.sourceType,
      amount: cashMovements.amount,
      occurredAt: cashMovements.occurredAt,
      notes: cashMovements.notes,
    })
    .from(cashMovements)
    .where(
      and(
        eq(cashMovements.sourceId, layawayId),
        inArray(cashMovements.sourceType, ["layaway_deposit", "layaway_payment"]),
        eq(cashMovements.status, "posted")
      )
    )
    .orderBy(cashMovements.occurredAt);

  console.log(`Movimientos antes del fix (${before.length}):`);
  for (const m of before) {
    console.log(`  [${m.sourceType.padEnd(16)}] ${m.occurredAt.toISOString().slice(0, 10)} | ${Number(m.amount).toLocaleString("es-CO")} | ${m.id}`);
    if (m.notes) console.log(`                       "${m.notes}"`);
  }

  // 3. Identificar los depósitos a borrar
  const toDelete = before.filter((m) => m.sourceType === "layaway_deposit");
  console.log(`\nMovimientos a eliminar (layaway_deposit): ${toDelete.length}`);

  if (toDelete.length !== 2) {
    console.error(`❌ Se esperaban exactamente 2 depósitos a borrar, pero hay ${toDelete.length}. Abortando.`);
    process.exit(1);
  }
  for (const m of toDelete) {
    console.log(`  - ${m.id} | ${m.occurredAt.toISOString().slice(0, 10)} | "${m.notes}"`);
  }

  // 4. Borrar dentro de transacción
  await db.transaction(async (tx) => {
    console.log("\n→ Ejecutando DELETE en transacción...");

    const deleted = await tx
      .delete(cashMovements)
      .where(
        and(
          eq(cashMovements.sourceId, layawayId),
          eq(cashMovements.sourceType, "layaway_deposit"),
          eq(cashMovements.status, "posted")
        )
      )
      .returning({ id: cashMovements.id });

    if (deleted.length !== 2) {
      throw new Error(`Se esperaba borrar 2 filas, pero se borraron ${deleted.length}. Rollback.`);
    }
    console.log(`✓ ${deleted.length} movimientos eliminados.`);
  });

  // 5. Auditar resultado
  const after = await db
    .select({
      id: cashMovements.id,
      sourceType: cashMovements.sourceType,
      amount: cashMovements.amount,
      occurredAt: cashMovements.occurredAt,
      notes: cashMovements.notes,
    })
    .from(cashMovements)
    .where(
      and(
        eq(cashMovements.sourceId, layawayId),
        inArray(cashMovements.sourceType, ["layaway_deposit", "layaway_payment"]),
        eq(cashMovements.status, "posted")
      )
    )
    .orderBy(cashMovements.occurredAt);

  const totalPaid = after.reduce((s, m) => s + Number(m.amount), 0);
  const balance   = Number(totalAmount) - totalPaid;

  console.log(`\nMovimientos después del fix (${after.length}):`);
  for (const m of after) {
    console.log(`  [${m.sourceType.padEnd(16)}] ${m.occurredAt.toISOString().slice(0, 10)} | ${Number(m.amount).toLocaleString("es-CO")} | ${m.id}`);
  }
  console.log(`\nTotal pagado: ${totalPaid.toLocaleString("es-CO")} COP`);
  console.log(`Balance:      ${balance.toLocaleString("es-CO")} COP`);

  if (after.length === 2 && balance > 0) {
    console.log(`\n✅ Fix aplicado correctamente.`);
    console.log(`   La UI mostrará el crédito como ACTIVE (no completado).`);
    console.log(`   El registro de pagos tiene 2 entradas (cuotas 1 y 2).\n`);
  } else {
    console.warn(`\n⚠️  Verificar manualmente — estado inesperado.`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
