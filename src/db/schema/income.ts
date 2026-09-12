import { pgTable, text, timestamp, decimal, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { layaways } from "./layaways";
import { loans } from "./loans";

/**
 * Ingresos que no vienen de vender un producto ni de intereses de crédito.
 *
 * Hoy sus orígenes son:
 * - Retención de capital cuando se cancela un crédito y el equipo se recupera ('retencion_credito').
 * - Comisión de originación cobrada al desembolsar un préstamo ('comision_originacion').
 */
export const otherIncome = pgTable("other_income", {
  id: uuid("id").defaultRandom().primaryKey(),
  // 'retencion_credito' | 'comision_originacion'
  concept: text("concept").notNull(),
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  date: timestamp("date").defaultNow().notNull(),
  description: text("description").notNull(),
  layawayId: uuid("layaway_id").references(() => layaways.id),
  loanId: uuid("loan_id").references(() => loans.id),
  createdBy: text("created_by").references(() => user.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
