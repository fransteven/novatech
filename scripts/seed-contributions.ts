/**
 * Idempotent one-time seed for historical shareholder capital contributions.
 * Run with: npx tsx scripts/seed-contributions.ts
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../src/db";

const CONTRIBUTIONS = [
  { fullName: "Frankly Estiven Chindicue Muñoz", amount: "23142000.00", notes: "Aporte inicial" },
  { fullName: "Juan Diego Torres", amount: "4000000.00", notes: "Aporte inicial" },
];

async function main() {
  console.log("Seeding historical shareholder contributions...");

  for (const c of CONTRIBUTIONS) {
    await db.execute(
      sql`
        INSERT INTO shareholder_contributions (shareholder_id, amount, notes, occurred_at)
        SELECT s.id, ${c.amount}::numeric, ${c.notes}, NOW()
        FROM shareholders s
        WHERE s.full_name = ${c.fullName}
          AND NOT EXISTS (
            SELECT 1 FROM shareholder_contributions sc
            WHERE sc.shareholder_id = s.id
              AND sc.notes = ${c.notes}
          )
      `,
    );
    console.log(`  ✅ ${c.fullName}: $${c.amount}`);
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
