import { pgTable, text, uuid, jsonb, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

// Rastro de auditoría para correcciones manuales sobre registros existentes
// (ej. corregir un costo mal ingresado). Nunca se sobreescribe ni se borra.
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  userName: text("user_name").notNull(), // snapshot: el nombre puede cambiar luego
  action: text("action").notNull(), // ej. "product_item.update"
  entityType: text("entity_type").notNull(), // ej. "product_item"
  entityId: text("entity_id").notNull(),
  changes: jsonb("changes").notNull(), // { campo: { old, new } } solo lo que cambió
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
