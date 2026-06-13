/**
 * payments.ts — Transformaciones puras sobre el cronograma.
 * Ninguna función toca la DB; retornan nuevo estado para que el servicio persista.
 */

import { money, roundCOP } from "@/lib/money";
import type { ScheduleEntry } from "./amortization";
import { generateSchedule } from "./amortization";

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
  newSchedule: ScheduleEntry[];
  newOutstandingPrincipal: number;
  newInstallmentAmount: number;
}

/**
 * Abono a capital: reduce el saldo insoluto y regenera el cronograma.
 *
 * @param state          Estado actual (cronograma + saldo insoluto)
 * @param monto          Monto del abono
 * @param strategy       "reduce_term" = misma cuota, menos cuotas
 *                       "reduce_installment" = mismo plazo, cuota menor
 * @param monthlyRate    Tasa mensual vigente
 * @param startDate      Fecha de referencia para las nuevas fechas de vencimiento
 */
export function applyAbonoCapital(
  state: CreditState,
  monto: number,
  strategy: CapitalStrategy,
  monthlyRate: number,
  startDate: Date
): AbonoCapitalResult {
  if (monto >= state.outstandingPrincipal) {
    throw new Error(
      "El abono a capital no puede ser igual o mayor al saldo insoluto. " +
        "Para saldar el crédito usa una cuota normal."
    );
  }
  if (monto <= 0) {
    throw new Error("El monto del abono debe ser positivo");
  }

  const newPrincipal = roundCOP(money(state.outstandingPrincipal).minus(monto)).toNumber();

  const pendingCount = state.schedule.filter((c) => c.status !== "pagada").length;
  const originalInstallment = state.schedule.find((c) => c.status !== "pagada")?.totalAmount ?? 0;

  let newTermMonths: number;

  if (strategy === "reduce_term") {
    // Misma cuota → calcular cuántos meses se necesitan para pagar newPrincipal
    // n = −ln(1 − P·i/cuota) / ln(1+i)   [despejando n de la fórmula francesa]
    const i = money(monthlyRate);
    const C = money(originalInstallment);
    const P = money(newPrincipal);
    const ratio = P.times(i).dividedBy(C); // P·i/C
    if (ratio.gte(1)) {
      // La cuota no alcanza a cubrir interés; usar misma cantidad de cuotas
      newTermMonths = pendingCount;
    } else {
      const raw = money(-1)
        .times(Math.log(1 - ratio.toNumber()))
        .dividedBy(Math.log(1 + monthlyRate));
      newTermMonths = Math.max(1, Math.ceil(raw.toNumber()));
    }
  } else {
    // Mismo plazo → misma cantidad de cuotas pendientes
    newTermMonths = pendingCount;
  }

  const newSchedule = generateSchedule({
    principal: newPrincipal,
    monthlyRate,
    termMonths: newTermMonths,
    startDate,
  });

  return {
    newSchedule,
    newOutstandingPrincipal: newPrincipal,
    newInstallmentAmount: newSchedule[0]?.totalAmount ?? 0,
  };
}
