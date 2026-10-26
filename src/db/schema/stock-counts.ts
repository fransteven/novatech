import {
  pgTable,
  text,
  integer,
  timestamp,
  decimal,
  uuid,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { products } from "./inventory";
import { user } from "./auth";

// --- TOMA DE INVENTARIO (conteo físico por escaneo) ---
// Un conteo es un borrador: se escanea mercancía (por zona/estante), se ajustan
// cantidades y costos, y sólo al aplicarlo entra al stock vía receiveStockLines.
// Se puede pausar y retomar otro día. No genera movimiento de caja: es stock
// existente, no una compra.
export const stockCounts = pgTable(
  "stock_counts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(), // ej. "Estante A – juegos PS5"
    status: text("status").default("draft").notNull(), // draft | applied | cancelled
    createdBy: text("created_by").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    appliedAt: timestamp("applied_at"),
  },
  (table) => [index("stock_counts_status_idx").on(table.status)],
);

export const stockCountLines = pgTable(
  "stock_count_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    countId: uuid("count_id")
      .references(() => stockCounts.id, { onDelete: "cascade" })
      .notNull(),
    productId: uuid("product_id")
      .references(() => products.id)
      .notNull(),
    // Condición de las unidades contadas (new | used | refurbished).
    condition: text("condition").default("new").notNull(),
    quantity: integer("quantity").notNull(),
    // Costo unitario. Puede quedar vacío mientras se cuenta; es obligatorio al aplicar.
    unitCost: decimal("unit_cost", { precision: 10, scale: 2 }),
    // Sólo productos serializados: un serial por unidad (quantity = length).
    serials: text("serials").array(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("stock_count_lines_unique").on(
      table.countId,
      table.productId,
      table.condition,
    ),
    index("stock_count_lines_count_id_idx").on(table.countId),
    check("stock_count_lines_quantity_check", sql`${table.quantity} >= 1`),
  ],
);
