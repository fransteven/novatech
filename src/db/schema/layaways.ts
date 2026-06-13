import {
  pgTable,
  text,
  integer,
  timestamp,
  decimal,
  uuid,
  boolean,
} from "drizzle-orm/pg-core";
import { customers } from "./customers";
import { products, productItems } from "./inventory";
import { cashMovements } from "./cash";
import { user } from "./auth";

// --- TABLA CABECERA: El documento de Apartado / Crédito ---
export const layaways = pgTable("layaways", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id")
    .references(() => customers.id)
    .notNull(),
  // Modalidad: 'sin_interes' (apartado simple) | 'credito' (con amortización)
  type: text("type").default("sin_interes").notNull(),
  status: text("status").default("active").notNull(),
  // status: 'cotizacion' | 'active' | 'completed' | 'cancelled' | 'defaulted'
  // Subestado de crédito activo: 'al_dia' | 'en_mora'
  subStatus: text("sub_status"),

  // --- Campos comunes ---
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),

  // --- Campos solo crédito (null para sin_interes) ---
  interestRate: decimal("interest_rate", { precision: 5, scale: 4 }),  // ej. 0.0500 = 5%
  financedCapital: decimal("financed_capital", { precision: 12, scale: 2 }),
  outstandingPrincipal: decimal("outstanding_principal", { precision: 12, scale: 2 }),
  termMonths: integer("term_months"),
  installmentAmount: decimal("installment_amount", { precision: 12, scale: 2 }),

  // --- Riesgo crediticio ---
  riskScore: integer("risk_score").default(0),
  riskLevel: text("risk_level").default("verde"), // 'verde' | 'amarillo' | 'rojo'
});

// --- TABLA DETALLE: Qué artículos exactos se están apartando ---
export const layawayDetails = pgTable("layaway_details", {
  id: uuid("id").defaultRandom().primaryKey(),
  layawayId: uuid("layaway_id")
    .references(() => layaways.id)
    .notNull(),
  productId: uuid("product_id")
    .references(() => products.id)
    .notNull(),
  productItemId: uuid("product_item_id").references(() => productItems.id), // Null si es producto genérico
  quantity: integer("quantity").default(1).notNull(),
  agreedPrice: decimal("agreed_price", { precision: 10, scale: 2 }).notNull(),
});

// --- CRONOGRAMA DE CUOTAS (solo crédito) ---
export const layawaySchedule = pgTable("layaway_schedule", {
  id: uuid("id").defaultRandom().primaryKey(),
  layawayId: uuid("layaway_id")
    .references(() => layaways.id)
    .notNull(),
  number: integer("number").notNull(),        // Número de cuota (1..n)
  dueDate: timestamp("due_date").notNull(),
  principal: decimal("principal", { precision: 12, scale: 2 }).notNull(),
  interest: decimal("interest", { precision: 12, scale: 2 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  remainingBalance: decimal("remaining_balance", { precision: 12, scale: 2 }).notNull(),
  status: text("status").default("pendiente").notNull(), // 'pendiente' | 'pagada' | 'vencida'
  paidAt: timestamp("paid_at"),
});

// --- LEDGER DE PAGOS DE CRÉDITO (inmutable, idempotente) ---
export const layawayPayments = pgTable("layaway_payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  layawayId: uuid("layaway_id")
    .references(() => layaways.id)
    .notNull(),
  // Tipo: 'cuota' | 'solo_interes' | 'abono_capital' | 'abono_sin_interes'
  type: text("type").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  principalPortion: decimal("principal_portion", { precision: 12, scale: 2 }).default("0"),
  interestPortion: decimal("interest_portion", { precision: 12, scale: 2 }).default("0"),
  scheduleNumber: integer("schedule_number"),
  // Estrategia de abono a capital: 'reduce_term' | 'reduce_installment'
  capitalStrategy: text("capital_strategy"),
  cashMovementId: uuid("cash_movement_id").references(() => cashMovements.id),
  // Garantiza idempotencia: el cliente genera un UUID por intento
  idempotencyKey: text("idempotency_key").unique().notNull(),
  createdBy: text("created_by").references(() => user.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// --- HISTORIAL DE RIESGO ---
export const riskHistory = pgTable("risk_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  layawayId: uuid("layaway_id")
    .references(() => layaways.id)
    .notNull(),
  previousScore: integer("previous_score").notNull(),
  newScore: integer("new_score").notNull(),
  level: text("level").notNull(),  // 'verde' | 'amarillo' | 'rojo'
  reason: text("reason").notNull(),
  occurredAt: timestamp("occurred_at").defaultNow().notNull(),
});

// --- NOTIFICACIONES IN-APP ---
export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Tipo: 'cuota_por_vencer' | 'mora' | 'riesgo_rojo'
  type: text("type").notNull(),
  layawayId: uuid("layaway_id").references(() => layaways.id),
  title: text("title").notNull(),
  message: text("message").notNull(),
  severity: text("severity").notNull(), // 'info' | 'warning' | 'danger'
  // Clave de deduplicación: evita alertas repetidas para el mismo evento
  dedupeKey: text("dedupe_key").unique().notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  readAt: timestamp("read_at"),
});
