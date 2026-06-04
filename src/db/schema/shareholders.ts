import {
  pgTable,
  text,
  uuid,
  numeric,
  boolean,
  timestamp,
  integer,
  unique,
} from "drizzle-orm/pg-core";

export const shareholders = pgTable("shareholders", {
  id: uuid("id").defaultRandom().primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email"),
  ownershipPct: numeric("ownership_pct", { precision: 5, scale: 2 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const shareholderDistributions = pgTable(
  "shareholder_distributions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    periodYear: integer("period_year").notNull(),
    totalNetProfit: numeric("total_net_profit", { precision: 14, scale: 2 }).notNull(),
    notes: text("notes"),
    status: text("status").notNull().default("pending"), // 'pending' | 'paid'
    declaredAt: timestamp("declared_at").defaultNow().notNull(),
    paidAt: timestamp("paid_at"),
  },
  (table) => [unique("uq_distribution_year").on(table.periodYear)],
);

export const shareholderDistributionItems = pgTable(
  "shareholder_distribution_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    distributionId: uuid("distribution_id")
      .references(() => shareholderDistributions.id, { onDelete: "cascade" })
      .notNull(),
    shareholderId: uuid("shareholder_id")
      .references(() => shareholders.id)
      .notNull(),
    ownershipPct: numeric("ownership_pct", { precision: 5, scale: 2 }).notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    paidAt: timestamp("paid_at"),
    cashMovementId: uuid("cash_movement_id"),
  },
);
