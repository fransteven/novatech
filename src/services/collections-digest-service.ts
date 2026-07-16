/**
 * collections-digest-service.ts — Digest diario de cobros para trabajadores.
 *
 * Recopila, para apartados y créditos activos, qué se debe cobrar hoy, qué
 * está en mora y qué vence en los próximos días; arma un correo consolidado
 * y lo envía a todos los usuarios de la app (no a los clientes).
 */

import { db } from "@/db";
import { layaways, layawaySchedule, customers, user, reminderLog } from "@/db/schema";
import { eq, and, or } from "drizzle-orm";
import { sendEmail } from "@/lib/email/send";
import { renderCollectionsDigestEmail } from "@/lib/email/templates/collections-digest";
import { getLLMProvider } from "@/lib/llm";

const POR_VENCER_DAYS = 3;

export type CollectionKind = "credito" | "apartado";

export interface CollectionRow {
  layawayId: string;
  tipo: CollectionKind;
  clienteNombre: string;
  clienteTelefono: string | null;
  cuotaNumero: number | null;
  monto: number;
  fecha: Date;
  diasMora: number; // > 0 solo para el bucket "enMora"
}

export interface DailyCollections {
  vencenHoy: CollectionRow[];
  enMora: CollectionRow[];
  porVencer: CollectionRow[];
}

/** Clave única por fila — un layaway puede tener varias cuotas en mora a la vez. */
export function rowKey(row: CollectionRow): string {
  return `${row.layawayId}:${row.cuotaNumero ?? "unica"}`;
}

const formatCOP = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

/**
 * Fecha (00:00 UTC) del día calendario de `date`, en UTC — nunca en la
 * timezone local del proceso. Los timestamps se guardan/leen en UTC (Neon
 * `timestamp` sin tz), así que anclar el cálculo de días en UTC evita que el
 * resultado cambie según dónde corra el servidor (Vercel, dev local, etc.).
 */
function startOfDayUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Diferencia en días calendario (UTC) entre `a` y `b`: positivo si a > b. */
function daysBetweenUTC(a: Date, b: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((startOfDayUTC(a).getTime() - startOfDayUTC(b).getTime()) / msPerDay);
}

export function classify(dueDate: Date, today: Date): "mora" | "hoy" | "porVencer" | "fuera" {
  const diff = daysBetweenUTC(dueDate, today);
  if (diff < 0) return "mora";
  if (diff === 0) return "hoy";
  if (diff <= POR_VENCER_DAYS) return "porVencer";
  return "fuera";
}

/**
 * Reúne cuotas de crédito (con cronograma) y apartados (por fecha de
 * expiración) y los clasifica en los 3 baldes del digest.
 */
export async function collectDailyCollections(refDate: Date = new Date()): Promise<DailyCollections> {
  const today = startOfDayUTC(refDate);
  const result: DailyCollections = { vencenHoy: [], enMora: [], porVencer: [] };

  // --- Créditos: cuotas pendientes/vencidas del cronograma ---
  const creditRows = await db
    .select({
      layawayId: layawaySchedule.layawayId,
      number: layawaySchedule.number,
      dueDate: layawaySchedule.dueDate,
      totalAmount: layawaySchedule.totalAmount,
      clienteNombre: customers.name,
      clienteTelefono: customers.phone,
    })
    .from(layawaySchedule)
    .innerJoin(layaways, eq(layawaySchedule.layawayId, layaways.id))
    .innerJoin(customers, eq(layaways.customerId, customers.id))
    .where(
      and(
        or(eq(layawaySchedule.status, "pendiente"), eq(layawaySchedule.status, "vencida")),
        eq(layaways.type, "credito"),
        eq(layaways.status, "active")
      )
    );

  for (const row of creditRows) {
    const dueDate = new Date(row.dueDate);
    const bucket = classify(dueDate, today);
    if (bucket === "fuera") continue;

    const diasMora = bucket === "mora" ? daysBetweenUTC(today, dueDate) : 0;
    const entry: CollectionRow = {
      layawayId: row.layawayId,
      tipo: "credito",
      clienteNombre: row.clienteNombre,
      clienteTelefono: row.clienteTelefono,
      cuotaNumero: row.number,
      monto: Number(row.totalAmount),
      fecha: dueDate,
      diasMora,
    };

    if (bucket === "mora") result.enMora.push(entry);
    else if (bucket === "hoy") result.vencenHoy.push(entry);
    else result.porVencer.push(entry);
  }

  // --- Apartados: sin cronograma, se clasifican por expiresAt ---
  const layawayRows = await db
    .select({
      id: layaways.id,
      expiresAt: layaways.expiresAt,
      totalAmount: layaways.totalAmount,
      clienteNombre: customers.name,
      clienteTelefono: customers.phone,
    })
    .from(layaways)
    .innerJoin(customers, eq(layaways.customerId, customers.id))
    .where(and(eq(layaways.type, "sin_interes"), eq(layaways.status, "active")));

  for (const row of layawayRows) {
    const dueDate = new Date(row.expiresAt);
    const bucket = classify(dueDate, today);
    if (bucket === "fuera") continue;

    const diasMora = bucket === "mora" ? daysBetweenUTC(today, dueDate) : 0;
    const entry: CollectionRow = {
      layawayId: row.id,
      tipo: "apartado",
      clienteNombre: row.clienteNombre,
      clienteTelefono: row.clienteTelefono,
      cuotaNumero: null,
      monto: Number(row.totalAmount),
      fecha: dueDate,
      diasMora,
    };

    if (bucket === "mora") result.enMora.push(entry);
    else if (bucket === "hoy") result.vencenHoy.push(entry);
    else result.porVencer.push(entry);
  }

  result.vencenHoy.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  result.porVencer.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  result.enMora.sort((a, b) => b.diasMora - a.diasMora);

  return result;
}

/**
 * Llama al LLM configurado (LLM_PROVIDER) con degradación agraciada: si no
 * hay proveedor configurado o la llamada falla, retorna null y el digest se
 * envía igual sin el contenido generado por IA.
 */
async function safeLLMGenerate(prompt: string, maxTokens: number): Promise<string | null> {
  try {
    const provider = getLLMProvider();
    const text = await provider.generate({ prompt, maxTokens });
    return text.trim() || null;
  } catch (err) {
    console.error("[collections-digest] Generación LLM falló:", err);
    return null;
  }
}

/** Resumen ejecutivo breve del día, para el encabezado del correo. */
export async function generateDigestNarrative(
  collections: DailyCollections,
  refDate: Date
): Promise<string | null> {
  const { vencenHoy, enMora, porVencer } = collections;
  if (vencenHoy.length + enMora.length + porVencer.length === 0) return null;

  const totalHoy = vencenHoy.reduce((s, r) => s + r.monto, 0);
  const totalMora = enMora.reduce((s, r) => s + r.monto, 0);
  const peorMora = enMora.reduce((max, r) => Math.max(max, r.diasMora), 0);
  const fechaFmt = refDate.toISOString().slice(0, 10);

  const prompt =
    `Redacta un resumen ejecutivo de máximo 3 frases (sin saludo ni despedida) ` +
    `para el equipo de cobros de NovaTech, una tienda de electrónica en Colombia, ` +
    `sobre la jornada de cobros del ${fechaFmt}. Datos: ${vencenHoy.length} cobros ` +
    `vencen hoy por ${formatCOP(totalHoy)}; ${enMora.length} están en mora por ` +
    `${formatCOP(totalMora)} en total (el caso más antiguo lleva ${peorMora} días); ` +
    `${porVencer.length} vencen en los próximos días. Indica qué priorizar primero. ` +
    `Tono directo y profesional, en español.`;

  return safeLLMGenerate(prompt, 250);
}

/**
 * Mensaje corto de cobro sugerido (WhatsApp) por cada cliente en mora.
 * Retorna un mapa keyed por `rowKey(row)`; las filas donde la generación
 * falló simplemente no aparecen en el mapa.
 */
export async function generateMoraMessages(enMora: CollectionRow[]): Promise<Map<string, string>> {
  const messages = new Map<string, string>();
  if (enMora.length === 0) return messages;

  await Promise.all(
    enMora.map(async (row) => {
      const tipoLabel = row.tipo === "credito" ? "crédito" : "apartado";
      const prompt =
        `Escribe un mensaje corto de WhatsApp (máximo 3 líneas, sin emojis) ` +
        `recordándole a ${row.clienteNombre} que tiene ${row.diasMora} días de mora ` +
        `en su ${tipoLabel} por ${formatCOP(row.monto)} con NovaTech. Tono cordial ` +
        `pero firme, sin amenazas, en español de Colombia.`;
      const text = await safeLLMGenerate(prompt, 150);
      if (text) messages.set(rowKey(row), text);
    })
  );

  return messages;
}

/** Correos de todos los usuarios de la app (destinatarios del digest). */
export async function getDigestRecipients(): Promise<string[]> {
  const rows = await db.select({ email: user.email }).from(user);
  return rows.map((r) => r.email);
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface SendDailyDigestOptions {
  /** Fuerza el reenvío aunque ya exista un digest hoy (botón manual). */
  force?: boolean;
}

export interface SendDailyDigestResult {
  status: "sent" | "failed" | "empty" | "skipped_duplicate";
  itemCount: number;
  error?: string;
}

/**
 * Orquesta el digest diario: recolecta cobros, arma el correo y lo envía a
 * todos los usuarios. Idempotente por día vía reminderLog.dedupeKey, salvo
 * que se pase `force` (disparo manual).
 */
export async function sendDailyDigest(
  refDate: Date = new Date(),
  options: SendDailyDigestOptions = {}
): Promise<SendDailyDigestResult> {
  const dateKey = toDateKey(refDate);
  const dedupeKey = options.force ? `digest:${dateKey}:manual:${Date.now()}` : `digest:${dateKey}`;

  if (!options.force) {
    const [existing] = await db
      .select({ id: reminderLog.id })
      .from(reminderLog)
      .where(eq(reminderLog.dedupeKey, dedupeKey))
      .limit(1);
    if (existing) {
      return { status: "skipped_duplicate", itemCount: 0 };
    }
  }

  const collections = await collectDailyCollections(refDate);
  const itemCount =
    collections.vencenHoy.length + collections.enMora.length + collections.porVencer.length;
  const recipients = await getDigestRecipients();

  if (itemCount === 0 || recipients.length === 0) {
    await db.insert(reminderLog).values({
      digestDate: dateKey,
      sentTo: recipients.join(", "),
      itemCount,
      dedupeKey,
      status: "empty",
    });
    return { status: "empty", itemCount };
  }

  const [narrative, moraMessages] = await Promise.all([
    generateDigestNarrative(collections, refDate),
    generateMoraMessages(collections.enMora),
  ]);

  const html = renderCollectionsDigestEmail(collections, refDate, { narrative, moraMessages });
  const sendResult = await sendEmail({
    to: recipients,
    subject: `Cobros del día — ${dateKey} (${itemCount} pendientes)`,
    html,
  });

  await db.insert(reminderLog).values({
    digestDate: dateKey,
    sentTo: recipients.join(", "),
    itemCount,
    dedupeKey,
    status: sendResult.ok ? "sent" : "failed",
    error: sendResult.error,
  });

  return { status: sendResult.ok ? "sent" : "failed", itemCount, error: sendResult.error };
}
