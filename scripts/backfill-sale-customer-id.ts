import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../src/db";

/**
 * El POS escribía el id del CLIENTE en `sales.user_id` (el slot del vendedor) y
 * nunca poblaba `sales.customer_id`. Este script mueve esos UUID a su columna
 * correcta para que la consulta de garantías por nombre de cliente funcione
 * sobre el histórico. Es idempotente: solo toca filas con customer_id NULL cuyo
 * user_id resuelve a un cliente real.
 */
async function main() {
  const before = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE customer_id IS NULL)                       AS sin_cliente,
      COUNT(*) FILTER (WHERE user_id IS NOT NULL)                       AS con_user_id,
      COUNT(*)                                                          AS total
    FROM sales;
  `);
  console.log("Antes:", before.rows[0]);

  const migrated = await db.execute(sql`
    UPDATE sales s
    SET customer_id = s.user_id::uuid,
        user_id     = NULL
    WHERE s.customer_id IS NULL
      AND s.user_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      AND EXISTS (SELECT 1 FROM customers c WHERE c.id = s.user_id::uuid)
    RETURNING s.id;
  `);
  console.log(`Ventas corregidas: ${migrated.rows.length}`);

  const after = await db.execute(sql`
    SELECT COUNT(*) FILTER (WHERE customer_id IS NULL) AS sin_cliente, COUNT(*) AS total
    FROM sales;
  `);
  console.log("Después:", after.rows[0]);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error en el backfill:", error);
    process.exit(1);
  });
