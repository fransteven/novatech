import {
  pgTable,
  text,
  timestamp,
  decimal,
  uuid,
  integer,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { productItems, products } from "./inventory";
import { customers } from "./customers";

export const sales = pgTable("sales", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id"), // Optional if guest checkout allowed
  customerId: uuid("customer_id").references(() => customers.id), // Opcional: Relación con el directorio de clientes
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").default("completed").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const saleDetails = pgTable(
  "sale_details",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    saleId: uuid("sale_id")
      .references(() => sales.id)
      .notNull(),
    productItemId: uuid("product_item_id").references(() => productItems.id),
    productId: uuid("product_id")
      .references(() => products.id)
      .notNull(),
    // Sin default: omitir el costo debe fallar de forma ruidosa, no registrar
    // 100% de margen en silencio.
    unitCost: decimal("unit_cost", { precision: 10, scale: 2 }).notNull(),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    // Unidades de esta línea. `price` y `unitCost` son SIEMPRE unitarios, así
    // que todo agregado de ingreso o costo debe multiplicar por esta columna.
    quantity: integer("quantity").default(1).notNull(),
  },
  (table) => [
    // Las líneas serializadas son una fila por unidad física: nunca más de 1.
    check(
      "sale_details_quantity_check",
      sql`${table.quantity} >= 1 AND (${table.productItemId} IS NULL OR ${table.quantity} = 1)`,
    ),
  ],
);
