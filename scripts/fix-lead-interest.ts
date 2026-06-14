/**
 * fix-lead-interest.ts
 *
 * One-shot migration: corrects all leads whose interest_rate was written as
 * "0.0000" due to the toDbString() bug (rounded COP integer, not a rate).
 * Sets them to the UI default of 5% (0.0500).
 *
 * Run: npx tsx scripts/fix-lead-interest.ts
 */

import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { leads } from "../src/db/schema";

const BAD_RATE = "0.0000";
const DEFAULT_RATE = "0.0500"; // 5 % mensual — the UI default

async function main() {
  console.log(`Searching for leads with interest_rate = ${BAD_RATE}...`);

  const badLeads = await db
    .select({ id: leads.id, prospectName: leads.prospectName, interestRate: leads.interestRate })
    .from(leads)
    .where(eq(leads.interestRate, BAD_RATE));

  if (badLeads.length === 0) {
    console.log("✅ No affected leads found. Nothing to do.");
    process.exit(0);
  }

  console.log(`Found ${badLeads.length} affected lead(s):`);
  for (const l of badLeads) {
    console.log(`  - ${l.id} | ${l.prospectName} | rate: ${l.interestRate}`);
  }

  await db
    .update(leads)
    .set({ interestRate: DEFAULT_RATE })
    .where(eq(leads.interestRate, BAD_RATE));

  console.log(`\n✅ Updated ${badLeads.length} lead(s) → interest_rate = ${DEFAULT_RATE} (5%).`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
