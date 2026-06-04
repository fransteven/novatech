import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../src/db";

async function main() {
  console.log("Applying migration 007: remove consignment, add shareholders...");

  try {
    // Drop FK from product_items to owners
    await db.execute(sql`ALTER TABLE "product_items" DROP CONSTRAINT IF EXISTS "product_items_owner_id_owners_id_fk"`);
    console.log("✅ Dropped FK product_items_owner_id_owners_id_fk");

    // Drop consignment columns
    await db.execute(sql`ALTER TABLE "product_items" DROP COLUMN IF EXISTS "owner_type"`);
    await db.execute(sql`ALTER TABLE "product_items" DROP COLUMN IF EXISTS "owner_id"`);
    console.log("✅ Dropped owner_type and owner_id from product_items");

    // Rename base_cost -> unit_cost
    await db.execute(sql`ALTER TABLE "product_items" RENAME COLUMN "base_cost" TO "unit_cost"`);
    console.log("✅ Renamed base_cost to unit_cost on product_items");

    // Drop commission_amount from sale_details
    await db.execute(sql`ALTER TABLE "sale_details" DROP COLUMN IF EXISTS "commission_amount"`);
    console.log("✅ Dropped commission_amount from sale_details");

    // Drop owners table
    await db.execute(sql`DROP TABLE IF EXISTS "owners"`);
    console.log("✅ Dropped owners table");

    // Create shareholders table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "shareholders" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "full_name" text NOT NULL,
        "email" text,
        "ownership_pct" numeric(5, 2) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    console.log("✅ Created shareholders table");

    // Create shareholder_distributions table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "shareholder_distributions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "period_year" integer NOT NULL,
        "total_net_profit" numeric(14, 2) NOT NULL,
        "notes" text,
        "status" text NOT NULL DEFAULT 'pending',
        "declared_at" timestamp DEFAULT now() NOT NULL,
        "paid_at" timestamp,
        CONSTRAINT "uq_distribution_year" UNIQUE ("period_year")
      )
    `);
    console.log("✅ Created shareholder_distributions table");

    // Create shareholder_distribution_items table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "shareholder_distribution_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "distribution_id" uuid NOT NULL,
        "shareholder_id" uuid NOT NULL,
        "ownership_pct" numeric(5, 2) NOT NULL,
        "amount" numeric(14, 2) NOT NULL,
        "paid_at" timestamp,
        "cash_movement_id" uuid
      )
    `);
    console.log("✅ Created shareholder_distribution_items table");

    // Add FK constraints
    await db.execute(sql`
      ALTER TABLE "shareholder_distribution_items"
        ADD CONSTRAINT "sdist_items_distribution_id_fk"
        FOREIGN KEY ("distribution_id")
        REFERENCES "shareholder_distributions"("id")
        ON DELETE cascade ON UPDATE no action
    `);
    await db.execute(sql`
      ALTER TABLE "shareholder_distribution_items"
        ADD CONSTRAINT "sdist_items_shareholder_id_fk"
        FOREIGN KEY ("shareholder_id")
        REFERENCES "shareholders"("id")
        ON DELETE no action ON UPDATE no action
    `);
    console.log("✅ Added FK constraints");

    // Seed shareholders
    await db.execute(sql`
      INSERT INTO "shareholders" ("full_name", "email", "ownership_pct", "is_active")
      VALUES
        ('Juan Diego Torres', NULL, 50.00, true),
        ('Frankly Estiven Chindicue Muñoz', NULL, 50.00, true)
      ON CONFLICT DO NOTHING
    `);
    console.log("✅ Seeded shareholders: Juan Diego Torres y Frankly Estiven Chindicue Muñoz");

    console.log("\n🎉 Migration 007 applied successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

main();
