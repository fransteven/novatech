/**
 * daily-board.ts — Tablero de cobro diario de créditos.
 *
 * Agrupa las cuotas abiertas de cada crédito en un único renglón por crédito
 * y lo ubica en un balde: en mora, vence hoy o próximo a vencer. La unidad es
 * el crédito y no la cuota porque el cobrador llama a un cliente, no a una
 * cuota: un crédito con tres cuotas atrasadas es una sola gestión.
 *
 * Los días se cuentan en calendario de America/Bogota: un crédito creado a
 * las 20:00 queda guardado con fecha UTC del día siguiente y, sin este
 * ajuste, sus cuotas aparecerían un día tarde en el tablero.
 */

export const BOARD_TIMEZONE = "America/Bogota";
export const UPCOMING_DAYS = 3;

const DAY_MS = 86_400_000;
const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BOARD_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 'YYYY-MM-DD' del día calendario de `date` en Bogotá. */
export function bogotaDateKey(date: Date): string {
  return dateKeyFormatter.format(date);
}

/** Días calendario (Bogotá) de `from` a `to`: positivo si `to` es posterior. */
export function bogotaDayDiff(from: Date, to: Date): number {
  const a = Date.parse(`${bogotaDateKey(from)}T00:00:00Z`);
  const b = Date.parse(`${bogotaDateKey(to)}T00:00:00Z`);
  return Math.round((b - a) / DAY_MS);
}

export type BoardBucket = "mora" | "hoy" | "proximos";

export interface OpenInstallment {
  layawayId: string;
  number: number;
  dueDate: Date;
  totalAmount: number;
  paidAmount: number;
}

export interface BoardCreditEntry {
  layawayId: string;
  bucket: BoardBucket;
  /** Saldo exigible: cuotas vencidas + la de hoy (o la próxima, en "proximos"). */
  amountDue: number;
  /** Cuotas que componen `amountDue`. */
  installments: number[];
  /** Días de atraso de la cuota más antigua (0 si no hay mora). */
  daysLate: number;
  /** Fecha de la cuota que define el balde. */
  dueDate: Date;
  /** Días hasta esa fecha (negativo = vencida). */
  daysToDue: number;
}

const remaining = (i: OpenInstallment) => Math.max(0, i.totalAmount - i.paidAmount);

/**
 * Clasifica los créditos según sus cuotas abiertas. Los créditos cuya próxima
 * cuota cae fuera de la ventana de `upcomingDays` no aparecen.
 */
export function buildCreditBoard(
  installments: OpenInstallment[],
  now: Date,
  upcomingDays: number = UPCOMING_DAYS,
): BoardCreditEntry[] {
  const byCredit = new Map<string, OpenInstallment[]>();
  for (const inst of installments) {
    if (remaining(inst) <= 0) continue;
    const list = byCredit.get(inst.layawayId) ?? [];
    list.push(inst);
    byCredit.set(inst.layawayId, list);
  }

  const entries: BoardCreditEntry[] = [];
  for (const [layawayId, list] of byCredit) {
    list.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    const withDays = list.map((i) => ({ ...i, days: bogotaDayDiff(now, i.dueDate) }));

    // Exigible hoy: todo lo vencido más lo que vence hoy.
    const exigible = withDays.filter((i) => i.days <= 0);
    if (exigible.length > 0) {
      const oldest = exigible[0];
      const isLate = oldest.days < 0;
      entries.push({
        layawayId,
        bucket: isLate ? "mora" : "hoy",
        amountDue: exigible.reduce((s, i) => s + remaining(i), 0),
        installments: exigible.map((i) => i.number),
        daysLate: isLate ? -oldest.days : 0,
        dueDate: oldest.dueDate,
        daysToDue: oldest.days,
      });
      continue;
    }

    const next = withDays[0];
    if (next.days <= upcomingDays) {
      entries.push({
        layawayId,
        bucket: "proximos",
        amountDue: remaining(next),
        installments: [next.number],
        daysLate: 0,
        dueDate: next.dueDate,
        daysToDue: next.days,
      });
    }
  }

  return entries.sort((a, b) => {
    if (a.bucket === "mora" && b.bucket === "mora") return b.daysLate - a.daysLate;
    return a.dueDate.getTime() - b.dueDate.getTime();
  });
}

/**
 * Enlace de WhatsApp para un teléfono colombiano. Los números de 10 dígitos
 * (celular local) reciben el indicativo 57; si ya traen indicativo se respetan.
 */
export function whatsappLink(phone: string | null, message?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const intl = digits.length === 10 ? `57${digits}` : digits;
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${intl}${text}`;
}
