import { describe, it, expect } from "vitest";
import { applyCuota, applySoloInteres, applyAbonoCapital, applyAbonoCuota } from "../payments";
import { generateSchedule } from "../amortization";
import type { ScheduleEntry } from "../amortization";

const BASE = new Date("2026-02-01");

const makeSchedule = (
  principal = 1_000_000,
  months = 6
): ScheduleEntry[] =>
  generateSchedule({
    principal,
    monthlyRate: 0.05,
    termMonths: months,
    startDate: BASE,
  });

describe("applyCuota", () => {
  it("marca la cuota n como 'pagada'", () => {
    const schedule = makeSchedule();
    const { schedule: result } = applyCuota(schedule, 1);
    expect(result[0].status).toBe("pagada");
  });

  it("la cuota marcada como pagada no cambia el resto", () => {
    const schedule = makeSchedule();
    const { schedule: result } = applyCuota(schedule, 1);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].status).toBe("pendiente");
    }
  });

  it("lanza error si la cuota ya está pagada", () => {
    const schedule = makeSchedule();
    const { schedule: paid } = applyCuota(schedule, 1);
    expect(() => applyCuota(paid, 1)).toThrow();
  });

  it("lanza error si número de cuota no existe", () => {
    const schedule = makeSchedule();
    expect(() => applyCuota(schedule, 99)).toThrow();
  });
});

describe("applySoloInteres", () => {
  it("retorna el monto de interés del periodo", () => {
    const schedule = makeSchedule();
    const { interest } = applySoloInteres(schedule, 1);
    // interés cuota 1 = 1_000_000 × 0.05
    expect(interest).toBe(50_000);
  });

  it("la cuota 5 sigue pendiente después de pago solo-interés (regla de negocio crítica)", () => {
    let schedule = makeSchedule();
    // Pagar cuotas 1-4 normales
    for (let i = 1; i <= 4; i++) {
      schedule = applyCuota(schedule, i).schedule;
    }
    // Pago solo-interés en cuota 5
    const { schedule: after } = applySoloInteres(schedule, 5);
    expect(after[4].status).toBe("pendiente"); // cuota 5 sigue pendiente
    // Cuota 6 también sigue pendiente
    expect(after[5].status).toBe("pendiente");
  });

  it("el cronograma NO avanza (misma cantidad de cuotas pendientes que antes)", () => {
    const schedule = makeSchedule();
    const pendientesBefore = schedule.filter((c) => c.status === "pendiente").length;
    const { schedule: after } = applySoloInteres(schedule, 1);
    const pendientesAfter = after.filter((c) => c.status === "pendiente").length;
    expect(pendientesAfter).toBe(pendientesBefore);
  });

  it("el capital NO se reduce (saldo insoluto intacto)", () => {
    const schedule = makeSchedule();
    const { schedule: after } = applySoloInteres(schedule, 1);
    // remainingBalance de cuota 1 no debe cambiar respecto al schedule original
    expect(after[0].remainingBalance).toBe(schedule[0].remainingBalance);
  });

  it("lanza error si la cuota ya está pagada", () => {
    const schedule = makeSchedule();
    const paid = applyCuota(schedule, 1).schedule;
    expect(() => applySoloInteres(paid, 1)).toThrow();
  });
});

describe("applyAbonoCuota", () => {
  it("no marca la cuota como pagada si el abono es parcial", () => {
    const schedule = makeSchedule(); // cuota 1 totalAmount ≈ 197,017
    const cuota1Total = schedule[0].totalAmount;
    const { schedule: after, fullyPaid } = applyAbonoCuota(schedule, 1, 100_000);
    expect(fullyPaid).toBe(false);
    expect(after[0].status).toBe("pendiente");
    expect(after[0].paidAmount).toBe(100_000);
    expect(after[0].paidAmount).toBeLessThan(cuota1Total);
  });

  it("el cronograma (fechas/montos) no cambia con un abono parcial", () => {
    const schedule = makeSchedule();
    const { schedule: after } = applyAbonoCuota(schedule, 1, 50_000);
    expect(after.length).toBe(schedule.length);
    expect(after[0].totalAmount).toBe(schedule[0].totalAmount);
    expect(after[1].dueDate).toEqual(schedule[1].dueDate);
  });

  it("acumula abonos sucesivos y marca 'pagada' al completar el total", () => {
    let schedule = makeSchedule();
    const total = schedule[0].totalAmount;
    const first = Math.floor(total / 2);
    const second = total - first;

    let result = applyAbonoCuota(schedule, 1, first);
    schedule = result.schedule;
    expect(result.fullyPaid).toBe(false);

    result = applyAbonoCuota(schedule, 1, second);
    expect(result.fullyPaid).toBe(true);
    expect(result.schedule[0].status).toBe("pagada");
    expect(result.schedule[0].paidAmount).toBe(total);
  });

  it("lanza error si el abono supera el saldo restante de la cuota", () => {
    const schedule = makeSchedule();
    const total = schedule[0].totalAmount;
    expect(() => applyAbonoCuota(schedule, 1, total + 1)).toThrow();
  });

  it("lanza error si la cuota ya está pagada", () => {
    const schedule = makeSchedule();
    const paid = applyCuota(schedule, 1).schedule;
    expect(() => applyAbonoCuota(paid, 1, 1_000)).toThrow();
  });

  it("reparte capital/interés proporcionalmente al split original de la cuota", () => {
    const schedule = makeSchedule();
    const cuota1 = schedule[0];
    const monto = Math.floor(cuota1.totalAmount / 2);
    const { principalPortion, interestPortion } = applyAbonoCuota(schedule, 1, monto);
    expect(principalPortion + interestPortion).toBe(monto);
    const expectedPrincipalRatio = cuota1.principal / cuota1.totalAmount;
    expect(principalPortion / monto).toBeCloseTo(expectedPrincipalRatio, 1);
  });
});

describe("applyAbonoCapital — reduce_term", () => {
  it("regenera el cronograma con menos cuotas", () => {
    const schedule = makeSchedule(1_000_000, 12);
    const result = applyAbonoCapital(
      { schedule, outstandingPrincipal: 1_000_000 },
      200_000,
      "reduce_term",
      0.05,
      BASE
    );
    expect(result.newSchedule.length).toBeLessThan(12);
  });

  it("el nuevo saldo insoluto = original - abono", () => {
    const result = applyAbonoCapital(
      { schedule: makeSchedule(1_000_000, 12), outstandingPrincipal: 1_000_000 },
      200_000,
      "reduce_term",
      0.05,
      BASE
    );
    expect(result.newOutstandingPrincipal).toBe(800_000);
  });

  it("la suma de capitales del nuevo cronograma = nuevo saldo insoluto", () => {
    const result = applyAbonoCapital(
      { schedule: makeSchedule(1_000_000, 12), outstandingPrincipal: 1_000_000 },
      300_000,
      "reduce_term",
      0.05,
      BASE
    );
    const sumCap = result.newSchedule.reduce((a, c) => a + c.principal, 0);
    expect(Math.abs(sumCap - result.newOutstandingPrincipal)).toBeLessThanOrEqual(1);
  });
});

describe("applyAbonoCapital — reduce_installment", () => {
  it("mantiene el mismo plazo con cuota más baja", () => {
    const schedule = makeSchedule(1_000_000, 12);
    const originalInstallment = schedule[0].totalAmount;
    const result = applyAbonoCapital(
      { schedule, outstandingPrincipal: 1_000_000 },
      200_000,
      "reduce_installment",
      0.05,
      BASE
    );
    expect(result.newSchedule.length).toBe(12);
    expect(result.newSchedule[0].totalAmount).toBeLessThan(originalInstallment);
  });

  it("saldo final del nuevo cronograma = 0", () => {
    const result = applyAbonoCapital(
      { schedule: makeSchedule(1_000_000, 12), outstandingPrincipal: 1_000_000 },
      200_000,
      "reduce_installment",
      0.05,
      BASE
    );
    const last = result.newSchedule[result.newSchedule.length - 1];
    expect(last.remainingBalance).toBe(0);
  });

  it("lanza error si abono >= saldo insoluto", () => {
    expect(() =>
      applyAbonoCapital(
        { schedule: makeSchedule(1_000_000, 12), outstandingPrincipal: 1_000_000 },
        1_000_000,
        "reduce_installment",
        0.05,
        BASE
      )
    ).toThrow();
  });
});
