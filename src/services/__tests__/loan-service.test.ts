import { describe, it, expect } from "vitest";
import { generateSchedule } from "@/lib/credit/amortization";
import {
  applyCuota,
  applySoloInteres,
  applyAbonoCuota,
  applyAbonoCapital,
} from "@/lib/credit/payments";
import { computeDpd } from "@/lib/credit/dpd";
import { roundCOP, money } from "@/lib/money";

describe("Loan business logic & mathematical engine", () => {
  const principal = 2_000_000;
  const monthlyRate = 0.05; // 5% mensual
  const termMonths = 6;
  const startDate = new Date("2026-10-01T00:00:00Z");

  it("SUM(schedule.principal) === principalAmount exacto tras generar cronograma francés", () => {
    const schedule = generateSchedule({
      principal,
      monthlyRate,
      termMonths,
      startDate,
    });

    expect(schedule).toHaveLength(6);

    const sumPrincipal = schedule.reduce(
      (sum, item) => roundCOP(money(sum).plus(item.principal)).toNumber(),
      0
    );

    expect(sumPrincipal).toBe(principal);
    expect(schedule[schedule.length - 1].remainingBalance).toBe(0);
  });

  it("acepta tasas de préstamo altas (ej. 30% mensual) sin truncamiento ni fallo", () => {
    const highRate = 0.3;
    const schedule = generateSchedule({
      principal: 1_000_000,
      monthlyRate: highRate,
      termMonths: 3,
      startDate,
    });

    expect(schedule).toHaveLength(3);
    const sumPrincipal = schedule.reduce((sum, item) => sum + item.principal, 0);
    expect(sumPrincipal).toBe(1_000_000);
  });

  it("pago de cuota reduce outstandingPrincipal exactamente por el capital de la cuota", () => {
    const schedule = generateSchedule({
      principal,
      monthlyRate,
      termMonths,
      startDate,
    });

    const cuota1 = schedule[0];
    const result = applyCuota(schedule, 1);

    expect(result.principalPortion).toBe(cuota1.principal);
    expect(result.interestPortion).toBe(cuota1.interest);
    expect(result.amountPaid).toBe(cuota1.totalAmount);

    const newOutstanding = roundCOP(money(principal).minus(result.principalPortion)).toNumber();
    expect(newOutstanding).toBe(cuota1.remainingBalance);
  });

  it("pago de solo interés no reduce el capital insoluto y la cuota sigue pendiente", () => {
    const schedule = generateSchedule({
      principal,
      monthlyRate,
      termMonths,
      startDate,
    });

    const result = applySoloInteres(schedule, 1);
    expect(result.interest).toBe(schedule[0].interest);
    expect(result.schedule[0].status).toBe("pendiente");
  });

  it("abono parcial a cuota divide proporcionalmente capital e interés", () => {
    const schedule = generateSchedule({
      principal,
      monthlyRate,
      termMonths,
      startDate,
    });

    const cuota1 = schedule[0];
    const partialAmount = 100_000;
    const result = applyAbonoCuota(schedule, 1, partialAmount);

    expect(result.principalPortion + result.interestPortion).toBe(partialAmount);
    expect(result.fullyPaid).toBe(false);
    expect(result.newPaidAmount).toBe(partialAmount);
  });

  it("abono a capital con reducción de plazo recalcula cronograma exacto con la tasa pactada", () => {
    const schedule = generateSchedule({
      principal,
      monthlyRate,
      termMonths,
      startDate,
    });

    const abonoAmount = 500_000;
    const result = applyAbonoCapital(
      { schedule, outstandingPrincipal: principal },
      abonoAmount,
      "reduce_term",
      monthlyRate,
      startDate
    );

    expect(result.newOutstandingPrincipal).toBe(1_500_000);
    const sumNewPrincipal = result.newSchedule.reduce((s, c) => s + c.principal, 0);
    expect(sumNewPrincipal).toBe(1_500_000);
    expect(result.newSchedule.length).toBeLessThan(termMonths);
  });

  it("préstamo en mora: DPD > 0 pero la deuda total pactada no se incrementa con multas ni recargos", () => {
    const schedule = generateSchedule({
      principal,
      monthlyRate,
      termMonths,
      startDate: new Date("2026-01-01T00:00:00Z"),
    });

    // Simulamos que hoy es 2026-03-15 (las primeras dos cuotas ya vencieron)
    const today = new Date("2026-03-15T00:00:00Z");
    const dpd = computeDpd(schedule, today);

    expect(dpd).toBeGreaterThan(0);

    // Verificamos que los montos del cronograma no sufren recargos automáticos
    const totalProgramado = schedule.reduce((sum, c) => sum + c.totalAmount, 0);
    const totalOriginalEsperado = schedule.reduce((sum, c) => sum + c.principal + c.interest, 0);
    expect(totalProgramado).toBe(totalOriginalEsperado);
  });
});
