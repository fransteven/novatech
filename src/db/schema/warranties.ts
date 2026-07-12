import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { customers } from "./customers";
import { productItems } from "./inventory";
import { user } from "./auth";

// --- GARANTÍA: se materializa por unidad al registrar un reclamo o ajustar
// la fecha de entrega. Antes de eso, la garantía se deriva "al vuelo" desde
// la venta/apartado en warranty-service.ts (ver isProvisional en esa capa). ---
export const warranties = pgTable(
  "warranties",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productItemId: uuid("product_item_id")
      .references(() => productItems.id)
      .notNull(),
    customerId: uuid("customer_id").references(() => customers.id),
    // Origen de la garantía: 'sale' | 'layaway' | 'manual'
    sourceType: text("source_type").notNull(),
    sourceId: uuid("source_id"), // saleId o layawayId de origen, si aplica
    // Snapshot de los meses de cobertura al momento de materializar
    warrantyMonths: integer("warranty_months").notNull(),
    // Fecha real de ENTREGA del equipo — no la fecha de venta/firma.
    // En apartados/créditos suele ser el inicio del contrato, no la liquidación.
    startDate: timestamp("start_date").defaultNow().notNull(),
    status: text("status").default("active").notNull(), // 'active' | 'void'
    notes: text("notes"),
    createdBy: text("created_by").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // Una garantía activa por unidad física
    uniqueIndex("warranties_product_item_unique").on(table.productItemId),
  ],
);

// --- RECLAMO DE GARANTÍA: cada vez que un cliente trae un equipo por falla ---
export const warrantyClaims = pgTable("warranty_claims", {
  id: uuid("id").defaultRandom().primaryKey(),
  warrantyId: uuid("warranty_id")
    .references(() => warranties.id)
    .notNull(),
  // Serial que el cliente presentó físicamente — permite detectar sustitución
  // si no coincide con el serial de la unidad vendida.
  reportedSerial: text("reported_serial"),
  issue: text("issue").notNull(), // Falla reportada por el cliente
  // 'abierto' | 'en_reparacion' | 'reparado' | 'reemplazado' | 'rechazado'
  status: text("status").default("abierto").notNull(),
  // Snapshot: ¿estaba vigente la garantía al momento de reportar el reclamo?
  withinWarranty: boolean("within_warranty").notNull(),
  resolutionNotes: text("resolution_notes"),
  handledBy: text("handled_by").references(() => user.id),
  reportedAt: timestamp("reported_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});
