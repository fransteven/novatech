/**
 * scripts/fix-fernando-duplicate-payment.ts
 *
 * El historial de pagos de Fernando muestra el abono inicial de 800.000 COP
 * dos veces porque quedó un cash_movement residual (layaway_deposit) del
 * layaway v1 original que no se eliminó al convertirlo a crédito.
 *
 * Estado actual:
 *   - layaway_payments: 1 fila correcta (hist_fernando_cuota_1 | layaway_payment)
 *   - cash_movements:   2 filas de 800.000
 *       [A] id=4f86371e  layaway_deposit  "Abono inicial"              ← ELIMINAR
 *       [B] id=7692c943  layaway_payment  "Cuota #1 (inicial)…"        ← CONSERVAR
 *
 * Acción: borrar solo el cash_movement residual [A]. No tocar layaway_payments,
 * schedule, outstandingPrincipal ni status.
 *
 * Run: npx tsx scripts/fix-fernando-duplicate-payment.ts
 */

import "dotenv/config";
import { and, eq, ilike } from "drizzle-orm";
import { db } from "../src/db";
import { layaways } from "../src/db/schema";
import { customers } from "../src/db/schema/customers";
import { cashMovements } from "../src/db/schema/cash";

async function main() {
  console.log("\n=== fix-fernando-duplicate-payment ===\n");

  // 1. Resolver layaway por nombre
  const rows = await db
    .select({
      layawayId: layaways.id,
      customerName: customers.name,
      status: layaways.status,
      totalAmount: layaways.totalAmount,
      outstandingPrincipal: layaways.outstandingPrincipal,
    })
    .from(layaways)
    .innerJoin(customers, eq(layaways.customerId, customers.id))
    .where(ilike(customers.name, "%fernando%"));

  if (rows.length === 0) {
    console.error("❌ No se encontró layaway para 'fernando'.");
    process.exit(1);
  }
  if (rows.length > 1) {
    console.error(`❌ Se encontraron ${rows.length} layaways con 'fernando'. Especificar más.`);
    for (const r of rows) console.error("  ", r);
    process.exit(1);
  }

  const { layawayId, customerName, status, totalAmount, outstandingPrincipal } = rows[0];
  console.log(`Cliente:              ${customerName}`);
  console.log(`Layaway:              ${layawayId}`);
  console.log(`Status:               ${status}`);
  console.log(`Total:                ${Number(totalAmount).toLocaleString("es-CO")} COP`);
  console.log(`Outstanding:          ${Number(outstandingPrincipal).toLocaleString("es-CO")} COP\n`);

  // 2. Auditar cash_movements antes
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
        eq(cashMovements.status, "posted"),
      )
    )
    .orderBy(cashMovements.occurredAt);

  console.log(`Cash movements antes del fix (${before.length}):`);
  for (const m of before) {
    const ts = m.occurredAt instanceof Date ? m.occurredAt.toISOString() : String(m.occurredAt);
    console.log(`  [${m.sourceType.padEnd(17)}] ${ts.slice(0, 19)} | ${Number(m.amount).toLocaleString("es-CO").padStart(12)} | ${m.id}`);
    if (m.notes) console.log(`  ${" ".repeat(20)} "${m.notes}"`);
  }

  // 3. Identificar el duplicado residual: cash_movement de tipo layaway_deposit
  const toDelete = before.filter((m) => m.sourceType === "layaway_deposit");

  console.log(`\nMovimientos a eliminar (layaway_deposit residual): ${toDelete.length}`);

  if (toDelete.length !== 1) {
    console.error(`❌ Se esperaba exactamente 1 layaway_deposit a borrar, pero hay ${toDelete.length}. Abortando.`);
    process.exit(1);
  }

  const dup = toDelete[0];
  console.log(`  → id=${dup.id} | amount=${Number(dup.amount).toLocaleString("es-CO")} | notes="${dup.notes}"`);

  // 4. Borrar dentro de transacción
  await db.transaction(async (tx) => {
    console.log("\n→ Ejecutando DELETE en transacción...");

    const deleted = await tx
      .delete(cashMovements)
      .where(eq(cashMovements.id, dup.id))
      .returning({ id: cashMovements.id });

    if (deleted.length !== 1) {
      throw new Error(`Se esperaba borrar 1 fila, pero se borraron ${deleted.length}. Rollback.`);
    }
    console.log(`✓ cash_movement ${deleted[0].id} eliminado.`);
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
        eq(cashMovements.status, "posted"),
      )
    )
    .orderBy(cashMovements.occurredAt);

  const totalPaid = after.reduce((s, m) => s + Number(m.amount), 0);
  const balance   = Number(totalAmount) - totalPaid;

  console.log(`\nCash movements después del fix (${after.length}):`);
  for (const m of after) {
    const ts = m.occurredAt instanceof Date ? m.occurredAt.toISOString() : String(m.occurredAt);
    console.log(`  [${m.sourceType.padEnd(17)}] ${ts.slice(0, 19)} | ${Number(m.amount).toLocaleString("es-CO").padStart(12)} | ${m.id}`);
    if (m.notes) console.log(`  ${" ".repeat(20)} "${m.notes}"`);
  }

  console.log(`\nTotal pagado:  ${totalPaid.toLocaleString("es-CO")} COP`);
  console.log(`Balance:       ${balance.toLocaleString("es-CO")} COP`);
  console.log(`Outstanding:   ${Number(outstandingPrincipal).toLocaleString("es-CO")} COP`);

  if (after.length === 1 && totalPaid === 800_000) {
    console.log(`\n✅ Fix aplicado correctamente.`);
    console.log(`   El historial de Fernando muestra el abono inicial 800.000 una sola vez.\n`);
  } else {
    console.warn(`\n⚠️  Verificar manualmente — estado inesperado.`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
