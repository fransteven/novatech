/**
 * scripts/delete-yimari-deposit.ts
 *
 * Borra el cash_movement "layaway_deposit" de 900,000 del crédito de Yimari.
 * Quedó del apartado original antes de convertirse a crédito; el usuario
 * confirmó que no aplica (el crédito amortiza el capital completo 4,600,000).
 *
 * Run: npx tsx scripts/delete-yimari-deposit.ts
 */

import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { cashMovements } from "../src/db/schema";

const LAYAWAY_ID = "23eeed5c-96de-442f-bbec-34d6d92fddb0";
const MOVEMENT_ID = "6bcb1246-e1d5-4c26-a577-2e0a4150205b";

async function main() {
  const [mov] = await db
    .select()
    .from(cashMovements)
    .where(eq(cashMovements.id, MOVEMENT_ID))
    .limit(1);

  if (!mov) throw new Error(`cash_movement ${MOVEMENT_ID} no encontrado.`);
  if (mov.sourceId !== LAYAWAY_ID) throw new Error("sourceId no coincide con el crédito de Yimari.");
  if (mov.sourceType !== "layaway_deposit") throw new Error(`sourceType inesperado: ${mov.sourceType}`);
  if (Number(mov.amount) !== 900000) throw new Error(`amount inesperado: ${mov.amount}`);

  console.log("Movimiento a borrar:", mov);

  await db.delete(cashMovements).where(eq(cashMovements.id, MOVEMENT_ID));

  console.log("\n✅ Abono inicial de 900,000 eliminado.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
