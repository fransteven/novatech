/**
 * dpd.ts — Cálculo de días de atraso (DPD = days past due).
 * Retorna el DPD de la cuota vencida más antigua aún pendiente.
 */

import type { ScheduleEntry } from "./amortization";

/**
 * Calcula el DPD actual del crédito.
 * DPD = días desde la fecha de vencimiento de la cuota pendiente más antigua que ya pasó.
 * Si no hay cuotas vencidas → 0.
 */
export function computeDpd(schedule: ScheduleEntry[], today: Date): number {
  const overdueEntries = schedule.filter(
    (c) => c.status === "pendiente" && c.dueDate < today
  );

  if (overdueEntries.length === 0) return 0;

  // La más antigua (menor número)
  const oldest = overdueEntries.reduce((a, b) =>
    a.number < b.number ? a : b
  );

  const diffMs = today.getTime() - oldest.dueDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// TODO confirmar: umbral para transición a 'defaulted' (propuesto DPD > 60,
// acción manual — el sistema no transiciona automáticamente).
export const DEFAULTED_DPD_THRESHOLD = 60;
