import { describe, it, expect } from "vitest";
import { generateSchedule } from "../amortization";
import { money, roundCOP } from "@/lib/money";

describe("generateSchedule — sistema francés / cuota fija", () => {
  const BASE_DATE = new Date("2026-02-01");

  describe("caso básico: 1.000.000 COP, 5% mensual, 12 meses", () => {
    const schedule = generateSchedule({
      principal: 1_000_000,
      monthlyRate: 0.05,
      termMonths: 12,
      startDate: BASE_DATE,
    });

    it("genera exactamente 12 cuotas", () => {
      expect(schedule).toHaveLength(12);
    });

    it("todas las cuotas tienen número correlativo 1..n", () => {
      schedule.forEach((c, i) => expect(c.number).toBe(i + 1));
    });

    it("todas las cuotas tienen el mismo totalAmount (cuota fija)", () => {
      const first = schedule[0].totalAmount;
      // La última puede diferir por ajuste de redondeo; el resto debe ser igual
      schedule.slice(0, -1).forEach((c) => {
        expect(c.totalAmount).toBe(first);
      });
    });

    it("la suma de los capitales es igual al principal", () => {
      const sumCapital = schedule.reduce(
        (acc, c) => acc + c.principal,
        0
      );
      // Tolerancia de 1 peso por redondeo
      expect(Math.abs(sumCapital - 1_000_000)).toBeLessThanOrEqual(1);
    });

    it("el saldo restante de la última cuota es 0", () => {
      const last = schedule[schedule.length - 1];
      expect(last.remainingBalance).toBe(0);
    });

    it("el saldo restante disminuye cuota a cuota", () => {
      for (let i = 1; i < schedule.length; i++) {
        expect(schedule[i].remainingBalance).toBeLessThan(
          schedule[i - 1].remainingBalance
        );
      }
    });

    it("cada cuota: capital + interés = totalAmount", () => {
      schedule.forEach((c) => {
        expect(c.principal + c.interest).toBe(c.totalAmount);
      });
    });

    it("cuota 1: interés = principal × tasa, redondeado a entero", () => {
      const expectedInterest = roundCOP(
        money(1_000_000).times(0.05)
      ).toNumber();
      expect(schedule[0].interest).toBe(expectedInterest);
    });

    it("todas las cuotas tienen estado 'pendiente'", () => {
      schedule.forEach((c) => expect(c.status).toBe("pendiente"));
    });

    it("dueDate de cuota 1 es 1 mes después de startDate", () => {
      const due = schedule[0].dueDate;
      expect(due.getUTCFullYear()).toBe(2026);
      expect(due.getUTCMonth()).toBe(2); // Marzo = índice 2
      expect(due.getUTCDate()).toBe(1);
    });
  });

  describe("caso n=1 (una cuota)", () => {
    const schedule = generateSchedule({
      principal: 500_000,
      monthlyRate: 0.05,
      termMonths: 1,
      startDate: BASE_DATE,
    });

    it("genera 1 cuota", () => {
      expect(schedule).toHaveLength(1);
    });

    it("totalAmount = principal + interés de un mes", () => {
      const expectedInterest = roundCOP(money(500_000).times(0.05)).toNumber();
      expect(schedule[0].totalAmount).toBe(500_000 + expectedInterest);
    });

    it("saldo restante = 0 tras la cuota", () => {
      expect(schedule[0].remainingBalance).toBe(0);
    });
  });

  describe("sin descuadre de centavos para monto 1.234.567 COP, 3 meses", () => {
    const schedule = generateSchedule({
      principal: 1_234_567,
      monthlyRate: 0.05,
      termMonths: 3,
      startDate: BASE_DATE,
    });

    it("suma de capitales = 1.234.567 (tolerancia 1 peso)", () => {
      const sum = schedule.reduce((a, c) => a + c.principal, 0);
      expect(Math.abs(sum - 1_234_567)).toBeLessThanOrEqual(1);
    });

    it("saldo final = 0", () => {
      expect(schedule[schedule.length - 1].remainingBalance).toBe(0);
    });
  });
});
