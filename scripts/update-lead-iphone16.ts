/**
 * scripts/update-lead-iphone16.ts
 *
 * Corrige el lead "Clienta iPhone 16 pro":
 *   salePrice:    2.770.000 → 2.670.000
 *   interestRate: 5% (0.0500) → 4% (0.0400)
 *
 * Run: npx tsx scripts/update-lead-iphone16.ts
 */

import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { leads } from "../src/db/schema";

const LEAD_ID = "532325d6-abba-4652-a7bb-ed9368cd368f";

async function main() {
  console.log("\n=== update-lead-iphone16 ===\n");

  const [before] = await db.select({ salePrice: leads.salePrice, interestRate: leads.interestRate })
    .from(leads).where(eq(leads.id, LEAD_ID)).limit(1);

  if (!before) { console.error("❌ Lead no encontrado"); process.exit(1); }

  console.log(`Antes: salePrice=${before.salePrice} | interestRate=${before.interestRate}`);

  await db.update(leads)
    .set({ salePrice: "2670000.00", interestRate: "0.0400", updatedAt: new Date() })
    .where(eq(leads.id, LEAD_ID));

  const [after] = await db.select({ salePrice: leads.salePrice, interestRate: leads.interestRate })
    .from(leads).where(eq(leads.id, LEAD_ID)).limit(1);

  console.log(`Después: salePrice=${after.salePrice} | interestRate=${after.interestRate}`);
  console.log("\n✅ Lead actualizado.\n");
  process.exit(0);
}

main().catch((e) => { console.error("❌ Error:", e); process.exit(1); });
