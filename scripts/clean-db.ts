import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../src/db";

async function main() {
  console.log(
    "Iniciando limpieza de la base de datos (purgado de datos transaccionales)...",
  );

  try {
    await db.execute(
      sql`TRUNCATE TABLE sale_details, sales, inventory_movements, reservations, expenses, product_items, products, categories, expense_categories CASCADE;`,
    );

    console.log("✅ Purga completada. Seeding accionistas...");

    // Seed shareholders (upsert by full_name to be idempotent)
    await db.execute(
      sql`INSERT INTO shareholders (full_name, email, ownership_pct, is_active)
          VALUES
            ('Juan Diego Torres', NULL, 50.00, true),
            ('Frankly Estiven Chindicue Muñoz', NULL, 50.00, true)
          ON CONFLICT DO NOTHING;`,
    );

    console.log("✅ Accionistas seeded: Juan Diego Torres y Frankly Estiven Chindicue Muñoz (50% c/u).");

    // Seed historical capital contributions
    await db.execute(
      sql`
        INSERT INTO shareholder_contributions (shareholder_id, amount, notes, occurred_at)
        SELECT id, 23142000, 'Aporte inicial', NOW() FROM shareholders WHERE full_name = 'Frankly Estiven Chindicue Muñoz'
        UNION ALL
        SELECT id,  4000000, 'Aporte inicial', NOW() FROM shareholders WHERE full_name = 'Juan Diego Torres'
        ON CONFLICT DO NOTHING
      `,
    );

    console.log("✅ Aportes iniciales seeded: Frankly 23.142.000 — Juan Diego 4.000.000.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error durante la limpieza de la base de datos:", error);
    process.exit(1);
  }
}

main();
