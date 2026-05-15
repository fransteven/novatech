import {
  pgTable,
  uuid,
  text,
  decimal,
  timestamp,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { cashAccounts } from "./cash";
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

export const purchases = pgTable("purchases", {
  id: uuid("id").defaultRandom().primaryKey(),
  providerId: uuid("provider_id")
    .references(() => providers.id)
    .notNull(),
  purchaseDate: timestamp("purchase_date").defaultNow().notNull(),
  invoiceNumber: text("invoice_number"),
  accountId: uuid("account_id")
    .references(() => cashAccounts.id)
    .notNull(),
  paymentMethod: text("payment_method").notNull().default("transfer"), // 'cash' | 'transfer' | 'card'
  referenceCode: text("reference_code"),
  subtotalAmount: decimal("subtotal_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  totalAmount: decimal("total_amount", { precision: 14, scale: 2 }).notNull(),
  notes: text("notes"),
  userId: text("user_id").references(() => user.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const purchaseDetails = pgTable("purchase_details", {
  id: uuid("id").defaultRandom().primaryKey(),
  purchaseId: uuid("purchase_id")
    .references(() => purchases.id)
    .notNull(),
  productId: uuid("product_id")
    .references(() => products.id)
    .notNull(),
  productItemId: uuid("product_item_id")
    .references(() => productItems.id), // Can be null for non-serialized
  quantity: integer("quantity").notNull().default(1),
  unitCost: decimal("unit_cost", { precision: 14, scale: 2 }).notNull(),
  lineTotal: decimal("line_total", { precision: 14, scale: 2 }).notNull(),
  serialNumber: text("serial_number"), // Only for serialized
  conditionDetails: jsonb("condition_details"), // Only for serialized
  notes: text("notes"),
});
