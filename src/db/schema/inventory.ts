import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  decimal,
  uuid,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

//Es la ficha del producto en el catálogo general
export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  template: jsonb("template"), // Defines attributes: [{ key: "brand", label: "Marca", type: "select", options: [...] }]
});

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: uuid("category_id").references(() => categories.id),
    sku: text("sku").unique(),
    name: text("name").notNull(),
    description: text("description"),
    //Precio de venta sugerido
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    isSerialized: boolean("is_serialized").default(false).notNull(),
    attributes: jsonb("attributes"), // Stores dynamic values: { brand: "Apple", storage: "256GB" }
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("products_name_attrs_unique").on(
      sql`TRIM(LOWER(${table.name}))`,
      sql`COALESCE((${table.attributes})::text, '')`,
    ),
  ],
);

export const productItems = pgTable("product_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id")
    .references(() => products.id)
    .notNull(),
  sku: text("sku"),
  serialNumber: text("serial_number"), // imei or serial
  status: text("status").default("available").notNull(), // available, sold, reserved, defective
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),

  // --- CONDICIÓN DE LA INSTANCIA FÍSICA ---
  conditionDetails: jsonb("condition_details"), // Almacena métricas variables ej: { batteryHealth: 85, grade: 'B' }
  notes: text("notes"), // Descripciones cualitativas ej: "Rasguño en display"

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const inventoryMovements = pgTable("inventory_movements", {
  id: uuid("id").defaultRandom().primaryKey(),
  productItemId: uuid("product_item_id").references(() => productItems.id),
  productId: uuid("product_id")
    .references(() => products.id)
    .notNull(), // For non-serialized tracking or redundancy
  type: text("type").notNull(), // IN, OUT, ADJUSTMENT
  quantity: integer("quantity").notNull(),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reservations = pgTable("reservations", {
  id: uuid("id").defaultRandom().primaryKey(),
  productItemId: uuid("product_item_id").references(() => productItems.id),
  userId: text("user_id").notNull(), // Link to Better Auth user ID (string usually)
  status: text("status").default("active").notNull(), // active, expired, completed
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
