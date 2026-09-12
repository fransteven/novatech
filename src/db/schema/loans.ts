import {
  pgTable,
  text,
  integer,
  timestamp,
  decimal,
  uuid,
} from "drizzle-orm/pg-core";
import { customers } from "./customers";
import { user } from "./auth";
import { cashMovements } from "./cash";

// --- TABLA CABECERA: Préstamo de Dinero ---
export const loans = pgTable("loans", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id")
    .references(() => customers.id)
    .notNull(),
  createdBy: text("created_by").references(() => user.id),
  // Estados: 'active' | 'completed' | 'cancelled' | 'defaulted'
  status: text("status").default("active").notNull(),
  // Subestado informativo de mora: 'al_dia' | 'en_mora'
  subStatus: text("sub_status").default("al_dia").notNull(),

  // Montos y condiciones financieras (Francés sobre saldo insoluto)
  principalAmount: decimal("principal_amount", { precision: 14, scale: 2 }).notNull(),
  outstandingPrincipal: decimal("outstanding_principal", { precision: 14, scale: 2 }).notNull(),
  // Tasa mensual pactada: OBLIGATORIA, sin default en DB ni código (ej. 0.0500 = 5%)
  interestRate: decimal("interest_rate", { precision: 5, scale: 4 }).notNull(),
  termMonths: integer("term_months").notNull(),
  installmentAmount: decimal("installment_amount", { precision: 14, scale: 2 }).notNull(),
  // Comisión de originación opcional
  originationFee: decimal("origination_fee", { precision: 14, scale: 2 }).default("0").notNull(),

  // Fechas de control
  disbursedAt: timestamp("disbursed_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(), // Fecha última cuota
  createdAt: timestamp("created_at").defaultNow().notNull(),

  // Garantía / Prenda / Codeudor y observaciones
  collateral: text("collateral"),
  notes: text("notes"),

  // Riesgo crediticio
  riskScore: integer("risk_score").default(0).notNull(),
  riskLevel: text("risk_level").default("verde").notNull(), // 'verde' | 'amarillo' | 'rojo'

  // Castigo de cartera
  writeOffAmount: decimal("write_off_amount", { precision: 14, scale: 2 }),
  writtenOffAt: timestamp("written_off_at"),

  // Idempotencia: previene doble desembolso de caja
  idempotencyKey: text("idempotency_key").unique().notNull(),
});

// --- CRONOGRAMA DE CUOTAS (Francés) ---
export const loanSchedule = pgTable("loan_schedule", {
  id: uuid("id").defaultRandom().primaryKey(),
  loanId: uuid("loan_id")
    .references(() => loans.id, { onDelete: "cascade" })
    .notNull(),
  number: integer("number").notNull(), // Número de cuota (1..n)
  dueDate: timestamp("due_date").notNull(),
  principal: decimal("principal", { precision: 14, scale: 2 }).notNull(),
  interest: decimal("interest", { precision: 14, scale: 2 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 14, scale: 2 }).notNull(),
  remainingBalance: decimal("remaining_balance", { precision: 14, scale: 2 }).notNull(),
  status: text("status").default("pendiente").notNull(), // 'pendiente' | 'pagada' | 'vencida'
  paidAt: timestamp("paid_at"),
  paidAmount: decimal("paid_amount", { precision: 14, scale: 2 }).default("0").notNull(),
});

// --- LEDGER DE PAGOS DEL PRÉSTAMO (inmutable, idempotente) ---
export const loanPayments = pgTable("loan_payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  loanId: uuid("loan_id")
    .references(() => loans.id)
    .notNull(),
  // Tipo: 'cuota' | 'solo_interes' | 'abono_capital' | 'abono_cuota'
  type: text("type").notNull(),
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  principalPortion: decimal("principal_portion", { precision: 14, scale: 2 }).default("0").notNull(),
  interestPortion: decimal("interest_portion", { precision: 14, scale: 2 }).default("0").notNull(),
  scheduleNumber: integer("schedule_number"),
  capitalStrategy: text("capital_strategy"), // 'reduce_term' | 'reduce_installment'
  cashMovementId: uuid("cash_movement_id").references(() => cashMovements.id),
  idempotencyKey: text("idempotency_key").unique().notNull(),
  createdBy: text("created_by").references(() => user.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
