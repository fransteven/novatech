import {
  pgTable,
  uuid,
  text,
  decimal,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { cashMovements } from "./cash";

// --- TABLA CABECERA: Acreedor (persona que presta dinero al negocio) ---
export const creditors = pgTable("creditors", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  contactPhone: text("contact_phone"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: text("created_by").references(() => user.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// --- LIBRO DE MOVIMIENTOS: Registro inmutable de préstamos y pagos ---
// kind:
//   'loan'     — el acreedor presta dinero al negocio (AUMENTA la deuda)
//   'payment'  — el negocio paga al acreedor (DISMINUYE la deuda)
//   'fee'      — comisión devengada por transacción (AUMENTA la deuda)
//   'interest' — interés devengado (AUMENTA la deuda)
//
// Saldo adeudado = SUM(amount WHERE kind IN ('loan','fee','interest'))
//                - SUM(amount WHERE kind = 'payment')
//
// compensationType (solo en kind='loan'):
//   'none'            — costo cero (altruista)
//   'per_transaction' — comisión fija por transacción cerrada
//   'interest_rate'   — tasa de interés periódica acordada
export const creditorMovements = pgTable("creditor_movements", {
  id: uuid("id").defaultRandom().primaryKey(),
  creditorId: uuid("creditor_id")
    .references(() => creditors.id)
    .notNull(),
  kind: text("kind").notNull(), // 'loan' | 'payment' | 'fee' | 'interest'
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),

  // Solo en kind='loan' — esquema de compensación de este préstamo
  compensationType: text("compensation_type"), // 'none' | 'per_transaction' | 'interest_rate'
  interestRate: decimal("interest_rate", { precision: 5, scale: 4 }), // ej. '0.0500' = 5%
  perTransactionFee: decimal("per_transaction_fee", { precision: 14, scale: 2 }), // ej. '100000.00'

  // Enlace a Caja (loan → direction:'in'; payment → direction:'out'; accruals sin enlace)
  cashMovementId: uuid("cash_movement_id").references(() => cashMovements.id),
  paymentMethod: text("payment_method"), // 'cash' | 'transfer' | 'card' | 'wallet'

  idempotencyKey: text("idempotency_key").unique().notNull(),
  occurredAt: timestamp("occurred_at").defaultNow().notNull(),
  notes: text("notes"),
  createdBy: text("created_by").references(() => user.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
