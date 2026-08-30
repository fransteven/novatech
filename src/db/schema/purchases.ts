import {
  pgTable,
  uuid,
  text,
  decimal,
  timestamp,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { cashAccounts, cashMovements } from "./cash";
import { products, productItems } from "./inventory";

export const providers = pgTable("providers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  socialMedia: jsonb("social_media"), // { instagram: '@...', facebook: '...' }
  country: text("country"),
  city: text("city"),
  location: text("location"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const purchases = pgTable(
  "purchases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerId: uuid("provider_id")
      .references(() => providers.id)
      .notNull(),
    purchaseDate: timestamp("purchase_date").defaultNow().notNull(),
    invoiceNumber: text("invoice_number"),

    // Cuenta de la que salió el pago inicial. Null cuando la compra queda
    // a crédito con el proveedor (no toca caja al registrarse).
    accountId: uuid("account_id").references(() => cashAccounts.id),
    paymentMethod: text("payment_method").notNull().default("transfer"), // 'cash' | 'transfer' | 'card'
    referenceCode: text("reference_code"),

    // subtotal = Σ (cantidad × costo unitario de factura)
    subtotalAmount: decimal("subtotal_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    // Costos adicionales (flete, casillero, arancel…) — se prorratean al costo
    // unitario aterrizado de cada ítem. Detalle en purchase_extra_costs.
    extraCostsAmount: decimal("extra_costs_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    // total = subtotalAmount + extraCostsAmount (siempre recalculado en el servidor)
    totalAmount: decimal("total_amount", { precision: 14, scale: 2 }).notNull(),

    // Estado de pago al proveedor. Derivado de amountPaid vs totalAmount.
    paymentStatus: text("payment_status").notNull().default("paid"), // 'paid' | 'partial' | 'pending'
    amountPaid: decimal("amount_paid", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),

    status: text("status").notNull().default("posted"), // 'posted' | 'voided'

    // Evita compras duplicadas por doble submit: el cliente genera un UUID por intento.
    idempotencyKey: text("idempotency_key").unique().notNull(),

    notes: text("notes"),
    userId: text("user_id")
      .references(() => user.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("purchases_provider_id_idx").on(table.providerId),
    index("purchases_purchase_date_idx").on(table.purchaseDate),
  ],
);

export const purchaseDetails = pgTable(
  "purchase_details",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    purchaseId: uuid("purchase_id")
      .references(() => purchases.id)
      .notNull(),
    productId: uuid("product_id")
      .references(() => products.id)
      .notNull(),
    productItemId: uuid("product_item_id").references(() => productItems.id), // Can be null for non-serialized
    quantity: integer("quantity").notNull().default(1),
    // Costo de factura, tal como lo cobró el proveedor.
    unitCost: decimal("unit_cost", { precision: 14, scale: 2 }).notNull(),
    // Costo aterrizado: unitCost + parte prorrateada de los costos adicionales.
    // Es el que se escribe en product_items / inventory_movements y el que
    // resolveItemCost lee al vender.
    landedUnitCost: decimal("landed_unit_cost", { precision: 14, scale: 2 }),
    lineTotal: decimal("line_total", { precision: 14, scale: 2 }).notNull(),
    serialNumber: text("serial_number"), // Only for serialized
    conditionDetails: jsonb("condition_details"), // Only for serialized
    notes: text("notes"),
  },
  (table) => [
    index("purchase_details_purchase_id_idx").on(table.purchaseId),
    index("purchase_details_product_id_idx").on(table.productId),
  ],
);

// --- COSTOS ADICIONALES DE LA COMPRA ---
// Conceptos que encarecen la mercancía sin ser precio de producto: flete,
// casillero, arancel, comisión de pago. Se prorratean por valor de línea.
export const purchaseExtraCosts = pgTable(
  "purchase_extra_costs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    purchaseId: uuid("purchase_id")
      .references(() => purchases.id)
      .notNull(),
    concept: text("concept").notNull(), // 'flete' | 'casillero' | 'arancel' | 'comision' | libre
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("purchase_extra_costs_purchase_id_idx").on(table.purchaseId),
  ],
);

// --- ABONOS AL PROVEEDOR ---
// Todo pago de una compra pasa por aquí, incluido el pago de contado del
// momento del registro. Un solo camino, sin caso especial.
export const purchasePayments = pgTable(
  "purchase_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    purchaseId: uuid("purchase_id")
      .references(() => purchases.id)
      .notNull(),
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
    accountId: uuid("account_id")
      .references(() => cashAccounts.id)
      .notNull(),
    paymentMethod: text("payment_method").notNull().default("transfer"), // 'cash' | 'transfer' | 'card' | 'wallet'
    referenceCode: text("reference_code"),
    // Enlace a Caja (siempre direction:'out', sourceType:'purchase_payment')
    cashMovementId: uuid("cash_movement_id").references(() => cashMovements.id),
    // Garantiza idempotencia: el cliente genera un UUID por intento
    idempotencyKey: text("idempotency_key").unique().notNull(),
    notes: text("notes"),
    userId: text("user_id")
      .references(() => user.id)
      .notNull(),
    occurredAt: timestamp("occurred_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("purchase_payments_purchase_id_idx").on(table.purchaseId)],
);
