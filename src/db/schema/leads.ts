import {
  pgTable,
  text,
  integer,
  timestamp,
  decimal,
  uuid,
} from "drizzle-orm/pg-core";
import { customers } from "./customers";
import { products } from "./inventory";
import { layaways } from "./layaways";
import { user } from "./auth";

// --- TABLA CABECERA: Prospecto de venta (Lead) ---
export const leads = pgTable("leads", {
  id: uuid("id").defaultRandom().primaryKey(),

  // Contacto inline (no requiere customer existente)
  prospectName: text("prospect_name").notNull(),
  prospectPhone: text("prospect_phone").notNull(),
  // Enlace opcional a cliente registrado
  customerId: uuid("customer_id").references(() => customers.id),

  // Pipeline: 'nuevo' | 'contactado' | 'negociando' | 'ganado' | 'perdido'
  stage: text("stage").default("nuevo").notNull(),
  lostReason: text("lost_reason"),

  // Producto de interés (texto libre; productId opcional si ya existe en inventario)
  productDescription: text("product_description").notNull(),
  productId: uuid("product_id").references(() => products.id),

  // Economía del trato
  costPrice: decimal("cost_price", { precision: 12, scale: 2 }).notNull(),
  salePrice: decimal("sale_price", { precision: 12, scale: 2 }).notNull(),
  interestRate: decimal("interest_rate", { precision: 5, scale: 4 }).default("0.0500").notNull(),
  termMonths: integer("term_months").default(12).notNull(),

  // Conversión a crédito (se llena al marcar 'ganado')
  layawayId: uuid("layaway_id").references(() => layaways.id),

  // Seguimiento
  lastContactedAt: timestamp("last_contacted_at"),
  notes: text("notes"),

  createdBy: text("created_by").references(() => user.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// --- ACTIVIDADES DEL LEAD (historial de interacciones) ---
export const leadActivities = pgTable("lead_activities", {
  id: uuid("id").defaultRandom().primaryKey(),
  leadId: uuid("lead_id")
    .references(() => leads.id)
    .notNull(),
  // 'nota' | 'cambio_etapa' | 'contacto' | 'ia_sugerencia'
  kind: text("kind").notNull(),
  content: text("content").notNull(),
  createdBy: text("created_by").references(() => user.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
