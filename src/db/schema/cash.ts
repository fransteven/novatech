import {
  pgTable,
  uuid,
  text,
  decimal,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const cashAccounts = pgTable("cash_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'cash' | 'bank' | 'wallet' | 'card_processor'
  currency: text("currency").notNull().default("COP"),
  openingBalance: decimal("opening_balance", { precision: 14, scale: 2 })
    .notNull()
    .default("0"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cashMovements = pgTable("cash_movements", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id")
    .references(() => cashAccounts.id)
    .notNull(),
  direction: text("direction").notNull(), // 'in' | 'out'
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  sourceType: text("source_type").notNull(), // 'sale_payment' | 'layaway_deposit' | 'expense' | 'import_cost' | 'refund' | 'shareholder_distribution' | 'transfer' | 'adjustment' | 'opening_balance' | 'creditor_loan' | 'creditor_payment'
  sourceId: uuid("source_id"), // intentionally no FK — polymorphic reference, resolved via sourceType
  paymentMethod: text("payment_method").default("cash"), // 'cash' | 'transfer' | 'card' | 'wallet'
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  referenceCode: text("reference_code"),
  notes: text("notes"),
  createdBy: text("created_by").references(() => user.id),
  status: text("status").notNull().default("posted"), // 'posted' | 'voided'
  voidedAt: timestamp("voided_at"),
  voidedBy: text("voided_by").references(() => user.id),
  voidReason: text("void_reason"),
});

export const cashTransfers = pgTable("cash_transfers", {
  id: uuid("id").defaultRandom().primaryKey(),
  fromAccountId: uuid("from_account_id")
    .references(() => cashAccounts.id)
    .notNull(),
  toAccountId: uuid("to_account_id")
    .references(() => cashAccounts.id)
    .notNull(),
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  feeAmount: decimal("fee_amount", { precision: 14, scale: 2 })
    .notNull()
    .default("0"),
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
  notes: text("notes"),
  createdBy: text("created_by").references(() => user.id),
  status: text("status").notNull().default("posted"), // 'posted' | 'voided'
  voidedAt: timestamp("voided_at"),
  voidedBy: text("voided_by").references(() => user.id),
  voidReason: text("void_reason"),
});

export const cashReconciliations = pgTable("cash_reconciliations", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id")
    .references(() => cashAccounts.id)
    .notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  expectedBalance: decimal("expected_balance", {
    precision: 14,
    scale: 2,
  }).notNull(),
  countedBalance: decimal("counted_balance", {
    precision: 14,
    scale: 2,
  }).notNull(),
  difference: decimal("difference", { precision: 14, scale: 2 }).notNull(), // must equal countedBalance - expectedBalance
  status: text("status").notNull().default("open"), // 'open' | 'closed'
  closedBy: text("closed_by").references(() => user.id),
  closedAt: timestamp("closed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
