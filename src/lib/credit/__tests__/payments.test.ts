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

describe("applyAbonoCapital — tasa pactada", () => {
  // La tasa varía por nivel de riesgo del cliente. Regenerar el cronograma con
  // otra tasa cobra un interés distinto al acordado, y el reporte de ganancias
  // lo registra como ingreso legítimo. Estos tests fijan que la tasa recibida
  // es la que se usa.
  it("el cronograma regenerado usa la tasa recibida, no un default", () => {
    const state = {
      schedule: makeSchedule(1_000_000, 12),
      outstandingPrincipal: 1_000_000,
    };

    const at4 = applyAbonoCapital(state, 200_000, "reduce_installment", 0.04, BASE);
    const at5 = applyAbonoCapital(state, 200_000, "reduce_installment", 0.05, BASE);

    // Primer interés = saldo nuevo × tasa
    expect(at4.newSchedule[0].interest).toBe(Math.round(800_000 * 0.04));
    expect(at5.newSchedule[0].interest).toBe(Math.round(800_000 * 0.05));
    expect(at4.newSchedule[0].interest).not.toBe(at5.newSchedule[0].interest);
  });

  it("con tasa menor la cuota resultante es menor", () => {
    const state = {
      schedule: makeSchedule(1_000_000, 12),
      outstandingPrincipal: 1_000_000,
    };

    const at4 = applyAbonoCapital(state, 200_000, "reduce_installment", 0.04, BASE);
    const at5 = applyAbonoCapital(state, 200_000, "reduce_installment", 0.05, BASE);

    expect(at4.newInstallmentAmount).toBeLessThan(at5.newInstallmentAmount);
  });
});

// ---------------------------------------------------------------------------
// Auditoría de modalidades de abono a capital
// ---------------------------------------------------------------------------

describe("applyAbonoCapital — auditoría reduce_term (misma cuota, menos plazo)", () => {
  const cases: Array<[number, number, number]> = [
    // [capital, plazo, abono] — abonos que dan un plazo no entero (caso del bug)
    [1_000_000, 12, 200_000],
    [1_000_000, 12, 137_500],
    [2_350_000, 18, 410_000],
    [3_000_000, 24, 999_999],
    [800_000, 6, 50_000],
    [800_000, 6, 5_000],
  ];

  it.each(cases)(
    "capital %i a %i meses, abono %i: la cuota NO baja",
    (principal, months, abono) => {
      const schedule = makeSchedule(principal, months);
      const cuota = schedule[0].totalAmount;
      const r = applyAbonoCapital(
        { schedule, outstandingPrincipal: principal },
        abono,
        "reduce_term",
        0.05,
        BASE
      );

      expect(r.newInstallmentAmount).toBe(cuota);
      const regular = r.newSchedule.slice(0, -1);
      for (const c of regular) expect(c.totalAmount).toBe(cuota);
      const last = r.newSchedule[r.newSchedule.length - 1];
      expect(last.totalAmount).toBeLessThanOrEqual(cuota);
      expect(last.totalAmount).toBeGreaterThan(0);
      expect(last.remainingBalance).toBe(0);
      // Abono pequeño puede no eliminar una cuota entera: solo achica la última
      expect(r.newSchedule.length).toBeLessThanOrEqual(months);
      const total = (xs: ScheduleEntry[]) => xs.reduce((a, c) => a + c.totalAmount, 0);
      expect(total(r.newSchedule)).toBeLessThan(total(schedule) - abono);

      const sumCap = r.newSchedule.reduce((a, c) => a + c.principal, 0);
      expect(sumCap).toBe(principal - abono);
      for (const c of r.newSchedule) {
        expect(c.principal + c.interest).toBe(c.totalAmount);
      }
    }
  );

  it("conserva cuotas pagadas, numeración y fechas originales", () => {
    let schedule = makeSchedule(1_000_000, 12);
    schedule = applyCuota(schedule, 1).schedule;
    schedule = applyCuota(schedule, 2).schedule;
    const outstanding = schedule[1].remainingBalance;
    const cuota = schedule[2].totalAmount;

    const r = applyAbonoCapital(
      { schedule, outstandingPrincipal: outstanding },
      150_000,
      "reduce_term",
      0.05,
      BASE
    );

    expect(r.newSchedule.slice(0, 2)).toEqual(schedule.slice(0, 2));
    expect(r.newPendingEntries[0].number).toBe(3);
    r.newPendingEntries.forEach((c, idx) => {
      expect(c.number).toBe(3 + idx);
      expect(c.dueDate).toEqual(schedule[2 + idx].dueDate);
      expect(c.status).toBe("pendiente");
    });
    expect(r.newPendingEntries[0].totalAmount).toBe(cuota);
    expect(r.newSchedule.length).toBeLessThan(12);
  });

  it("primer interés se calcula sobre el saldo después del abono", () => {
    const r = applyAbonoCapital(
      { schedule: makeSchedule(1_000_000, 12), outstandingPrincipal: 1_000_000 },
      200_000,
      "reduce_term",
      0.05,
      BASE
    );
    expect(r.newSchedule[0].interest).toBe(40_000);
  });

  it("con una sola cuota pendiente la liquida con el nuevo saldo", () => {
    let schedule = makeSchedule(1_000_000, 3);
    schedule = applyCuota(schedule, 1).schedule;
    schedule = applyCuota(schedule, 2).schedule;
    const outstanding = schedule[1].remainingBalance;
    const r = applyAbonoCapital(
      { schedule, outstandingPrincipal: outstanding },
      100_000,
      "reduce_term",
      0.05,
      BASE
    );
    expect(r.newPendingEntries).toHaveLength(1);
    expect(r.newPendingEntries[0].principal).toBe(outstanding - 100_000);
    expect(r.newPendingEntries[0].dueDate).toEqual(schedule[2].dueDate);
  });
});

describe("applyAbonoCapital — auditoría reduce_installment (mismo plazo, cuota menor)", () => {
  it("mismo número de cuotas pendientes, cuota menor, fechas preservadas", () => {
    let schedule = makeSchedule(1_000_000, 12);
    schedule = applyCuota(schedule, 1).schedule;
    const outstanding = schedule[0].remainingBalance;
    const cuota = schedule[1].totalAmount;

    const r = applyAbonoCapital(
      { schedule, outstandingPrincipal: outstanding },
      200_000,
      "reduce_installment",
      0.05,
      BASE
    );

    expect(r.newSchedule).toHaveLength(12);
    expect(r.newPendingEntries).toHaveLength(11);
    expect(r.newInstallmentAmount).toBeLessThan(cuota);
    r.newPendingEntries.forEach((c, idx) => {
      expect(c.number).toBe(2 + idx);
      expect(c.dueDate).toEqual(schedule[1 + idx].dueDate);
    });
    const sumCap = r.newPendingEntries.reduce((a, c) => a + c.principal, 0);
    expect(sumCap).toBe(outstanding - 200_000);
    expect(r.newSchedule[0]).toEqual(schedule[0]);
  });
});

describe("applyAbonoCapital — comparación de modalidades", () => {
  it("reducir plazo paga menos interés total que reducir cuota", () => {
    const state = { schedule: makeSchedule(1_000_000, 12), outstandingPrincipal: 1_000_000 };
    const term = applyAbonoCapital(state, 300_000, "reduce_term", 0.05, BASE);
    const inst = applyAbonoCapital(state, 300_000, "reduce_installment", 0.05, BASE);
    const interest = (s: ScheduleEntry[]) => s.reduce((a, c) => a + c.interest, 0);
    expect(interest(term.newSchedule)).toBeLessThan(interest(inst.newSchedule));
    expect(term.newInstallmentAmount).toBeGreaterThan(inst.newInstallmentAmount);
  });

  it("no modifica el cronograma recibido (función pura)", () => {
    const schedule = makeSchedule(1_000_000, 12);
    const copy = structuredClone(schedule);
    applyAbonoCapital({ schedule, outstandingPrincipal: 1_000_000 }, 200_000, "reduce_term", 0.05, BASE);
    expect(schedule).toEqual(copy);
  });
});

describe("applyAbonoCapital — validaciones", () => {
  const state = () => ({ schedule: makeSchedule(1_000_000, 12), outstandingPrincipal: 1_000_000 });

  it.each(["reduce_term", "reduce_installment"] as const)(
    "%s: rechaza si hay cuotas vencidas (no borra la mora)",
    (strategy) => {
      // Cuota 1 vence 2026-03-01; abono el 2026-03-10
      expect(() =>
        applyAbonoCapital(state(), 200_000, strategy, 0.05, new Date("2026-03-10T15:00:00Z"))
      ).toThrow(/vencida/);
    }
  );

  it("permite abonar el mismo día del vencimiento (aún no está en mora)", () => {
    const s = state();
    // Mismo día calendario en Bogotá, unas horas después del vencimiento
    const dueDay = new Date(s.schedule[0].dueDate.getTime() + 2 * 3_600_000);
    expect(() => applyAbonoCapital(s, 200_000, "reduce_term", 0.05, dueDay)).not.toThrow();
  });

  it("rechaza cuota marcada 'vencida' aunque la fecha sea futura", () => {
    const s = state();
    s.schedule[0] = { ...s.schedule[0], status: "vencida" };
    expect(() => applyAbonoCapital(s, 200_000, "reduce_term", 0.05, BASE)).toThrow(/vencida/);
  });

  it("rechaza si una cuota pendiente tiene abono parcial", () => {
    const s = state();
    s.schedule = applyAbonoCuota(s.schedule, 1, 10_000).schedule;
    expect(() => applyAbonoCapital(s, 200_000, "reduce_term", 0.05, BASE)).toThrow(/abono parcial/);
  });

  it("rechaza monto <= 0", () => {
    expect(() => applyAbonoCapital(state(), 0, "reduce_term", 0.05, BASE)).toThrow();
    expect(() => applyAbonoCapital(state(), -5, "reduce_installment", 0.05, BASE)).toThrow();
  });

  it("rechaza monto >= saldo insoluto", () => {
    expect(() => applyAbonoCapital(state(), 1_000_000, "reduce_term", 0.05, BASE)).toThrow();
    expect(() => applyAbonoCapital(state(), 1_200_000, "reduce_term", 0.05, BASE)).toThrow();
  });
});
