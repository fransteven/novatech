/**
 * payments.ts — Transformaciones puras sobre el cronograma.
 * Ninguna función toca la DB; retornan nuevo estado para que el servicio persista.
 */

import { money, roundCOP } from "@/lib/money";
import type { ScheduleEntry } from "./amortization";
import { generateSchedule, generateFixedInstallmentSchedule } from "./amortization";
import { bogotaDayDiff } from "./daily-board";

export interface CreditState {
  schedule: ScheduleEntry[];
  outstandingPrincipal: number;
}

// ---------------------------------------------------------------------------
// applyCuota
// ---------------------------------------------------------------------------

export interface ApplyCuotaResult {
  schedule: ScheduleEntry[];
  principalPortion: number;
  interestPortion: number;
  amountPaid: number;
}

/**
 * Marca la cuota `n` como pagada.
 * Retorna el cronograma actualizado y los montos de capital/interés aplicados.
 */
export function applyCuota(
  schedule: ScheduleEntry[],
  n: number
): ApplyCuotaResult {
  const idx = schedule.findIndex((c) => c.number === n);
  if (idx === -1) throw new Error(`Cuota ${n} no existe en el cronograma`);

  const cuota = schedule[idx];
  if (cuota.status === "pagada") {
    throw new Error(`La cuota ${n} ya fue pagada`);
  }

  const updated = schedule.map((c, i) =>
    i === idx ? { ...c, status: "pagada" as const, paidAt: new Date() } : c
  );

  return {
    schedule: updated,
    principalPortion: cuota.principal,
    interestPortion: cuota.interest,
    amountPaid: cuota.totalAmount,
  };
}

// ---------------------------------------------------------------------------
// applyAbonoCuota
// ---------------------------------------------------------------------------

export interface ApplyAbonoCuotaResult {
  schedule: ScheduleEntry[];
  principalPortion: number;
  interestPortion: number;
  fullyPaid: boolean;
  newPaidAmount: number;
}

/**
 * Abono parcial a la cuota `n` — NO cambia el cronograma.
 *
 * El acumulado (`paidAmount`) de la cuota crece con cada abono. La cuota
 * solo pasa a 'pagada' cuando el acumulado alcanza el total de la cuota.
 * El capital/interés del abono se reconoce de forma proporcional al split
 * original de la cuota, para mantener el saldo insoluto y el ledger
 * consistentes con los reportes de utilidad.
 */
export function applyAbonoCuota(
  schedule: ScheduleEntry[],
  n: number,
  monto: number
): ApplyAbonoCuotaResult {
  const idx = schedule.findIndex((c) => c.number === n);
  if (idx === -1) throw new Error(`Cuota ${n} no existe en el cronograma`);

  const cuota = schedule[idx];
  if (cuota.status === "pagada") {
    throw new Error(`La cuota ${n} ya fue pagada`);
  }
  if (monto <= 0) {
    throw new Error("El monto del abono debe ser positivo");
  }

  const paidSoFar = cuota.paidAmount ?? 0;
  const remaining = roundCOP(money(cuota.totalAmount).minus(paidSoFar)).toNumber();
  if (monto > remaining) {
    throw new Error(
      `El abono (${monto}) supera el saldo de la cuota (${remaining}). ` +
        "Usa 'Cuota normal' para saldarla."
    );
  }

  const principalPortion = roundCOP(
    money(monto).times(cuota.principal).dividedBy(cuota.totalAmount)
  ).toNumber();
  const interestPortion = roundCOP(money(monto).minus(principalPortion)).toNumber();

  const newPaidAmount = roundCOP(money(paidSoFar).plus(monto)).toNumber();
  const fullyPaid = newPaidAmount >= cuota.totalAmount;

  const updated = schedule.map((c, i) =>
    i === idx
      ? {
          ...c,
          paidAmount: newPaidAmount,
          status: fullyPaid ? ("pagada" as const) : c.status,
          paidAt: fullyPaid ? new Date() : c.paidAt,
        }
      : c
  );

  return { schedule: updated, principalPortion, interestPortion, fullyPaid, newPaidAmount };
}

// ---------------------------------------------------------------------------
// applySoloInteres
// ---------------------------------------------------------------------------

export interface ApplySoloInteresResult {
  schedule: ScheduleEntry[];
  interest: number;
}

/**
 * Pago de solo interés del periodo.
 * - El capital NO se reduce.
 * - El cronograma NO avanza (cuota n sigue 'pendiente').
 * - Solo se registra el interés cobrado.
 *
 * Regla de negocio: la cuota n vuelve a deber capital+interés en el siguiente
 * periodo. El cliente "compró" un mes de plazo a cambio del interés.
 */
export function applySoloInteres(
  schedule: ScheduleEntry[],
  n: number
): ApplySoloInteresResult {
  const idx = schedule.findIndex((c) => c.number === n);
  if (idx === -1) throw new Error(`Cuota ${n} no existe en el cronograma`);

  const cuota = schedule[idx];
  if (cuota.status === "pagada") {
    throw new Error(`La cuota ${n} ya fue pagada; no se puede pagar solo interés`);
  }

  // El cronograma no cambia visualmente (cuota sigue pendiente).
  // El interés cobrado se calcula sobre el saldo insoluto vigente de esa cuota.
  const interest = cuota.interest;

  return {
    schedule: [...schedule], // sin cambios
    interest,
  };
}

// ---------------------------------------------------------------------------
// applyAbonoCapital
// ---------------------------------------------------------------------------

export type CapitalStrategy = "reduce_term" | "reduce_installment";

export interface AbonoCapitalResult {
  /** Cronograma completo: cuotas pagadas intactas + cuotas pendientes regeneradas. */
  newSchedule: ScheduleEntry[];
  /** Solo las cuotas pendientes regeneradas (las que el servicio reemplaza en DB). */
  newPendingEntries: ScheduleEntry[];
  newOutstandingPrincipal: number;
  newInstallmentAmount: number;
}

/**
 * Abono a capital: reduce el saldo insoluto y regenera SOLO las cuotas pendientes.
 *
 * - "reduce_term": la cuota se conserva exacta; se eliminan cuotas del final y
 *   la última absorbe el residuo (≤ cuota).
 * - "reduce_installment": mismo número de cuotas pendientes, cuota menor.
 *
 * Reglas:
 * - Las cuotas pagadas no se tocan (historial).
 * - Las cuotas regeneradas heredan número y fecha de vencimiento de las
 *   pendientes originales, en orden: el calendario pactado no se corre.
 * - Se rechaza si hay cuotas vencidas (el abono borraría la mora) o cuotas
 *   pendientes con abono parcial (su interés ya cobrado se cobraría dos veces).
 *
 * @param state          Estado actual (cronograma + saldo insoluto)
 * @param monto          Monto del abono
 * @param strategy       Estrategia de recálculo
 * @param monthlyRate    Tasa mensual pactada
 * @param today          Fecha del abono (para detectar mora, calendario Bogotá)
 */
export function applyAbonoCapital(
  state: CreditState,
  monto: number,
  strategy: CapitalStrategy,
  monthlyRate: number,
  today: Date
): AbonoCapitalResult {
  if (monto <= 0) {
    throw new Error("El monto del abono debe ser positivo");
  }
  if (monto >= state.outstandingPrincipal) {
    throw new Error(
      "El abono a capital no puede ser igual o mayor al saldo insoluto. " +
        "Para saldar el crédito usa una cuota normal."
    );
  }

  const paid = state.schedule.filter((c) => c.status === "pagada");
  const pending = state.schedule
    .filter((c) => c.status !== "pagada")
    .sort((a, b) => a.number - b.number);
  if (pending.length === 0) {
    throw new Error("El crédito no tiene cuotas pendientes");
  }

  const overdue = pending.filter(
    (c) => c.status === "vencida" || bogotaDayDiff(c.dueDate, today) > 0
  );
  if (overdue.length > 0) {
    throw new Error(
      `El crédito tiene ${overdue.length} cuota(s) vencida(s) ` +
        `(#${overdue.map((c) => c.number).join(", #")}). ` +
        "Ponte al día antes de abonar a capital."
    );
  }

  const partial = pending.find((c) => (c.paidAmount ?? 0) > 0);
  if (partial) {
    throw new Error(
      `La cuota #${partial.number} tiene un abono parcial. ` +
        "Complétala antes de abonar a capital."
    );
  }

  const newPrincipal = roundCOP(money(state.outstandingPrincipal).minus(monto)).toNumber();

  let regenerated: ScheduleEntry[];
  if (strategy === "reduce_term" && pending.length > 1) {
    // La cuota vigente es la de una pendiente regular (no la última, que lleva residuo)
    const installment = pending[0].totalAmount;
    regenerated = generateFixedInstallmentSchedule({
      principal: newPrincipal,
      monthlyRate,
      installment,
      maxTerm: pending.length,
    });
  } else {
    regenerated = generateSchedule({
      principal: newPrincipal,
      monthlyRate,
      termMonths: pending.length,
      startDate: today, // fechas se reemplazan abajo
    });
  }

  // Heredar número y fecha de las pendientes originales
  const newPendingEntries = regenerated.map((e, idx) => ({
    ...e,
    number: pending[idx].number,
    dueDate: pending[idx].dueDate,
  }));

  const newSchedule = [...paid, ...newPendingEntries].sort((a, b) => a.number - b.number);

  return {
    newSchedule,
    newPendingEntries,
    newOutstandingPrincipal: newPrincipal,
    newInstallmentAmount: newPendingEntries[0].totalAmount,
  };
}

// ---------------------------------------------------------------------------
// previewAbonoCapital (para la UI)
// ---------------------------------------------------------------------------

export interface ScheduleRowLike {
  number: number;
  dueDate: Date | string;
  principal: number | string;
  interest: number | string;
  totalAmount: number | string;
  remainingBalance?: number | string;
  paidAmount?: number | string | null;
  status: string;
}

export type AbonoCapitalPreview =
  | { ok: true; installment: number; pendingCount: number; lastDueDate: Date; totalInterest: number }
  | { ok: false; error: string };

/** Simula el abono a capital con filas tal como llegan de la DB/acciones. */
export function previewAbonoCapital(
  rows: ScheduleRowLike[],
  outstandingPrincipal: number,
  monto: number,
  strategy: CapitalStrategy,
  monthlyRate: number,
  today: Date = new Date()
): AbonoCapitalPreview {
  const schedule: ScheduleEntry[] = rows.map((r) => ({
    number: r.number,
    dueDate: new Date(r.dueDate),
    principal: Number(r.principal),
    interest: Number(r.interest),
    totalAmount: Number(r.totalAmount),
    remainingBalance: Number(r.remainingBalance ?? 0),
    status: r.status as ScheduleEntry["status"],
    paidAt: null,
    paidAmount: Number(r.paidAmount ?? 0),
  }));
  try {
    const res = applyAbonoCapital(
      { schedule, outstandingPrincipal },
      monto,
      strategy,
      monthlyRate,
      today
    );
    const pending = res.newPendingEntries;
    return {
      ok: true,
      installment: res.newInstallmentAmount,
      pendingCount: pending.length,
      lastDueDate: pending[pending.length - 1].dueDate,
      totalInterest: pending.reduce((a, c) => a + c.interest, 0),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo simular el abono" };
  }
}
