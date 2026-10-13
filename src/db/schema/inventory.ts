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
  index,
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
    // Meses de cobertura de garantía para este modelo (ej. 12 para iPhone nuevo,
    // menos para otras marcas). Si es null, se usa DEFAULT_WARRANTY_MONTHS.
    warrantyMonths: integer("warranty_months"),
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

export const productItems = pgTable(
  "product_items",
  {
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
    // new | used | refurbished. Es de la unidad física, no del catálogo: el
    // mismo modelo convive nuevo y de segunda con costo, precio y garantía
    // distintos. Los productos no serializados no tienen fila aquí: se asumen
    // nuevos.
    condition: text("condition").default("new").notNull(),
    // Override de cobertura para unidades no nuevas (1, 3 o 6 meses).
    // Null = política del modelo (products.warranty_months) o de la casa.
    warrantyMonths: integer("warranty_months"),
    conditionDetails: jsonb("condition_details"), // Almacena métricas variables ej: { batteryHealth: 85, grade: 'B' }
    notes: text("notes"), // Descripciones cualitativas ej: "Rasguño en display"

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // Un serial/IMEI no puede repetirse en el inventario. Parcial: los ítems
    // no serializados guardan NULL y quedan fuera del índice.
    uniqueIndex("product_items_serial_unique")
      .on(table.serialNumber)
      .where(sql`${table.serialNumber} IS NOT NULL`),
    index("product_items_product_id_idx").on(table.productId),
    index("product_items_condition_idx").on(table.condition),
  ],
);

// Códigos de barras alternativos de un producto (seriales de caja, UPC/EAN).
// Pensado para los NO serializados, que no tienen fila en product_items: el
// lector del POS/inventario escanea el serial o el UPC de la caja y debe
// resolver al producto. Varias cajas pueden repetir serial, por eso el código
// es del producto y no de una unidad.
export const productBarcodes = pgTable(
  "product_barcodes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .references(() => products.id, { onDelete: "cascade" })
      .notNull(),
    code: text("code").notNull(), // normalizado: sin espacios y en mayúsculas
    kind: text("kind").default("serial").notNull(), // serial | upc
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // Un código resuelve a un único producto.
    uniqueIndex("product_barcodes_code_unique").on(table.code),
    index("product_barcodes_product_id_idx").on(table.productId),
  ],
);

export const inventoryMovements = pgTable(
  "inventory_movements",
  {
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
  },
  (table) => [
    // Los lee calculateProductWAC y resolveItemCost en cada venta.
    index("inventory_movements_product_id_idx").on(table.productId),
    index("inventory_movements_product_item_id_idx").on(table.productItemId),
  ],
);

export const reservations = pgTable("reservations", {
  id: uuid("id").defaultRandom().primaryKey(),
  productItemId: uuid("product_item_id").references(() => productItems.id),
  userId: text("user_id").notNull(), // Link to Better Auth user ID (string usually)
  status: text("status").default("active").notNull(), // active, expired, completed
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
