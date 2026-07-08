/**
 * scripts/update-mireya-creditor.ts
 *
 * Actualiza el campo `notes` del préstamo único de Mireya Muñoz Orozco
 * para documentar el desglose del capital prestado:
 *   - Credito local salsa $300.000
 *   - Huevos $345.000
 *   - Pago Creditos Grajales $470.000
 *   Total: $1.115.000
 *
 * Run: npx tsx scripts/update-mireya-creditor.ts
 */

import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { creditorMovements } from "../src/db/schema";

const LOAN_ID = "22ad6cf2-86fe-4030-a8a4-5c50c09485fa";

const NOTES =
  "- Credito local salsa $300.000,\n- Huevos $345.000\nPago Creditos Grajales $470.000.";

async function main() {
  console.log("Buscando préstamo de Mireya...");

  const [movement] = await db
    .select()
    .from(creditorMovements)
    .where(eq(creditorMovements.id, LOAN_ID))
    .limit(1);

  if (!movement) {
    console.error(`❌ Movimiento ${LOAN_ID} no encontrado.`);
    process.exit(1);
  }

  if (movement.kind !== "loan") {
    console.error(`❌ El movimiento no es un préstamo (kind = ${movement.kind}).`);
    process.exit(1);
  }

  console.log("Movimiento encontrado:");
  console.log(`  id:     ${movement.id}`);
  console.log(`  kind:   ${movement.kind}`);
  console.log(`  amount: ${movement.amount}`);
  console.log(`  notes (antes): ${movement.notes ?? "(null)"}`);

  await db.transaction(async (tx) => {
    await tx
      .update(creditorMovements)
      .set({ notes: NOTES })
      .where(eq(creditorMovements.id, LOAN_ID));
  });

  console.log(`\n  notes (después):\n${NOTES}`);
  console.log("\n✅ Notas del préstamo de Mireya actualizadas.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
