import { pgTable, text, timestamp, decimal, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { layaways } from "./layaways";

/**
 * Ingresos que no vienen de vender un producto ni de intereses de crédito.
 *
 * Hoy su único origen es la retención de capital cuando se cancela un crédito
 * y el equipo se recupera: la plata que el cliente ya pagó se queda en el
 * negocio, y sin este registro quedaría en caja sin contrapartida en el
 * reporte de ganancias (caja y utilidad descuadradas por ese monto).
 *
 * Cuando el equipo NO se recupera no se usa esta tabla: eso es una venta al
 * precio efectivamente cobrado, y se registra en `sales` con su costo real.
 */
export const otherIncome = pgTable("other_income", {
  id: uuid("id").defaultRandom().primaryKey(),
  // 'retencion_credito'
  concept: text("concept").notNull(),
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  date: timestamp("date").defaultNow().notNull(),
  description: text("description").notNull(),
  layawayId: uuid("layaway_id").references(() => layaways.id),
  createdBy: text("created_by").references(() => user.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
