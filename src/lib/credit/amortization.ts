/**
 * amortization.ts — Sistema francés / cuota fija sobre saldo insoluto.
 * Fórmula: cuota = P · i / (1 − (1+i)^−n)
 * Todo dinero pasa por money.ts (Decimal.js, redondeo HALF_UP COP entero).
 */

import { money, roundCOP, sub, mul, add } from "@/lib/money";
import Decimal from "decimal.js";

export interface ScheduleEntry {
  number: number;
  dueDate: Date;
  principal: number;
  interest: number;
  totalAmount: number;
  remainingBalance: number;
  status: "pendiente" | "pagada" | "vencida";
  paidAt: Date | null;
}

export interface GenerateScheduleParams {
  principal: number;
  monthlyRate: number;
  termMonths: number;
  startDate: Date;
}

/**
 * Genera la tabla de amortización francesa completa.
 * La última cuota absorbe el centavo residual para que saldo cierre en 0.
 */
export function generateSchedule({
  principal,
  monthlyRate,
  termMonths,
  startDate,
}: GenerateScheduleParams): ScheduleEntry[] {
  if (termMonths < 1) throw new Error("El plazo debe ser al menos 1 mes");
  if (principal <= 0) throw new Error("El capital debe ser positivo");
  if (monthlyRate <= 0) throw new Error("La tasa debe ser positiva");

  const P = money(principal);
  const i = money(monthlyRate);
  const n = termMonths;

  // cuota = P · i / (1 − (1+i)^−n)
  const onePlusI = add(1, i); // (1+i)
  const denom = sub(1, money(1).dividedBy(onePlusI.pow(n))); // 1 − (1+i)^−n
  const rawInstallment = P.times(i).dividedBy(denom);
  const installment = roundCOP(rawInstallment);

  const schedule: ScheduleEntry[] = [];
  let balance = new Decimal(principal);

  for (let k = 1; k <= n; k++) {
    const isLast = k === n;

    // Interés sobre saldo vigente
    const interestDec = roundCOP(balance.times(i));

    let capitalDec: Decimal;
    let totalDec: Decimal;

    if (isLast) {
      // La última cuota paga exactamente el saldo restante + su interés
      capitalDec = balance;
      totalDec = add(capitalDec, interestDec);
    } else {
      capitalDec = roundCOP(sub(installment, interestDec));
      totalDec = installment;
    }

    const newBalance = roundCOP(sub(balance, capitalDec));

    // Fecha de vencimiento: startDate + k meses (UTC-safe)
    const dueDate = new Date(startDate);
    dueDate.setUTCMonth(dueDate.getUTCMonth() + k);

    schedule.push({
      number: k,
      dueDate,
      principal: capitalDec.toNumber(),
      interest: interestDec.toNumber(),
      totalAmount: totalDec.toNumber(),
      remainingBalance: isLast ? 0 : newBalance.toNumber(),
      status: "pendiente",
      paidAt: null,
    });

    balance = isLast ? new Decimal(0) : newBalance;
  }

  return schedule;
}
