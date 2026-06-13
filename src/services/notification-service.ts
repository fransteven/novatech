/**
 * notification-service.ts — Gestión de notificaciones in-app.
 * Idempotente por dedupeKey; no genera alertas duplicadas para el mismo evento.
 */

import { db } from "@/db";
import { notifications, layaways, layawaySchedule } from "@/db/schema";
import { eq, isNull, or, sql, desc, and } from "drizzle-orm";

export type NotificationType = "cuota_por_vencer" | "mora" | "riesgo_rojo" | "seguimiento_lead";
export type NotificationSeverity = "info" | "warning" | "danger";

export interface CreateNotificationInput {
  type: NotificationType;
  layawayId?: string;
  leadId?: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  dedupeKey: string;
}

/**
 * Crea una notificación solo si no existe una con la misma dedupeKey.
 * Idempotente: llamar dos veces con la misma key es seguro.
 */
export async function createNotification(
  input: CreateNotificationInput,
  tx?: Parameters<typeof db.insert>[0] extends undefined ? typeof db : typeof db
): Promise<void> {
  const dbClient = (tx as typeof db) ?? db;
  // INSERT ... ON CONFLICT DO NOTHING (dedupeKey es UNIQUE)
  await dbClient
    .insert(notifications)
    .values({
      type: input.type,
      layawayId: input.layawayId ?? null,
      leadId: input.leadId ?? null,
      title: input.title,
      message: input.message,
      severity: input.severity,
      dedupeKey: input.dedupeKey,
    })
    .onConflictDoNothing();
}

export async function getUnreadNotifications() {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.isRead, false))
    .orderBy(desc(notifications.createdAt))
    .limit(50);
}

export async function getAllNotifications() {
  return db
    .select()
    .from(notifications)
    .orderBy(desc(notifications.createdAt))
    .limit(100);
}

export async function getUnreadCount(): Promise<number> {
  const result = await db
    .select({ count: sql<number>`COUNT(*)`.mapWith(Number) })
    .from(notifications)
    .where(eq(notifications.isRead, false));
  return result[0]?.count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(eq(notifications.id, id));
}

export async function markAllNotificationsRead(): Promise<void> {
  await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(eq(notifications.isRead, false));
}

/**
 * Detecta cuotas próximas a vencer (dentro de los próximos DUE_SOON_DAYS días)
 * y crea notificaciones. Llamar desde getLayaways.
 *
 * TODO confirmar: ventana "próxima a vencer" (propuesto ≤3 días).
 */
const DUE_SOON_DAYS = 3;

export async function detectUpcomingDue(): Promise<void> {
  const today = new Date();
  const limit = new Date(today);
  limit.setDate(limit.getDate() + DUE_SOON_DAYS);

  // Cuotas pendientes que vencen entre hoy y el límite
  const upcoming = await db
    .select({
      scheduleId: layawaySchedule.id,
      layawayId: layawaySchedule.layawayId,
      number: layawaySchedule.number,
      dueDate: layawaySchedule.dueDate,
      totalAmount: layawaySchedule.totalAmount,
    })
    .from(layawaySchedule)
    .innerJoin(layaways, eq(layawaySchedule.layawayId, layaways.id))
    .where(
      and(
        eq(layawaySchedule.status, "pendiente"),
        eq(layaways.type, "credito"),
        eq(layaways.status, "active"),
        sql`${layawaySchedule.dueDate} >= ${today}`,
        sql`${layawaySchedule.dueDate} <= ${limit}`
      )
    );

  for (const item of upcoming) {
    const due = new Date(item.dueDate);
    const dueFmt = due.toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    await createNotification({
      type: "cuota_por_vencer",
      layawayId: item.layawayId,
      title: "Cuota próxima a vencer",
      message: `Cuota #${item.number} vence el ${dueFmt}.`,
      severity: "warning",
      dedupeKey: `cuota_por_vencer:${item.layawayId}:${item.number}:${due.toISOString().slice(0, 10)}`,
    });
  }
}
