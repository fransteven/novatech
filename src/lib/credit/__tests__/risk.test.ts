import { describe, it, expect } from "vitest";
import { computeRiskScore } from "../risk";
import { DEFAULT_RISK_CONFIG } from "../risk-config";

const cfg = DEFAULT_RISK_CONFIG;

describe("computeRiskScore — factores individuales", () => {
  const base = {
    dpd: 0,
    lateInstallments: 0,
    soloInteresCount: 0,
    consecutiveSoloInteres: 0,
    pctPrincipalPaid: 0,
  };

  describe("DPD (días de atraso actuales)", () => {
    it("0 días → 0 puntos", () => {
      expect(computeRiskScore({ ...base, dpd: 0 }, cfg).score).toBe(0);
    });

    it("1–15 días → 15 puntos", () => {
      expect(computeRiskScore({ ...base, dpd: 1 }, cfg).score).toBe(15);
      expect(computeRiskScore({ ...base, dpd: 15 }, cfg).score).toBe(15);
    });

    it("16–30 días → 30 puntos", () => {
      expect(computeRiskScore({ ...base, dpd: 16 }, cfg).score).toBe(30);
      expect(computeRiskScore({ ...base, dpd: 30 }, cfg).score).toBe(30);
    });

    it("31–60 días → 50 puntos", () => {
      expect(computeRiskScore({ ...base, dpd: 31 }, cfg).score).toBe(50);
      expect(computeRiskScore({ ...base, dpd: 60 }, cfg).score).toBe(50);
    });

    it(">60 días → 70 puntos", () => {
      expect(computeRiskScore({ ...base, dpd: 61 }, cfg).score).toBe(70);
      expect(computeRiskScore({ ...base, dpd: 120 }, cfg).score).toBe(70);
    });
  });

  describe("Atrasos históricos (+5 por cuota tarde, tope 25)", () => {
    it("1 atraso → +5", () => {
      expect(computeRiskScore({ ...base, lateInstallments: 1 }, cfg).score).toBe(5);
    });

    it("5 atrasos → +25 (tope)", () => {
      expect(computeRiskScore({ ...base, lateInstallments: 5 }, cfg).score).toBe(25);
    });

    it("10 atrasos → +25 (no supera tope)", () => {
      expect(computeRiskScore({ ...base, lateInstallments: 10 }, cfg).score).toBe(25);
    });
  });

  describe("Pagos solo-interés (+8 c/u, tope 30)", () => {
    it("1 solo-interés → +8", () => {
      expect(computeRiskScore({ ...base, soloInteresCount: 1 }, cfg).score).toBe(8);
    });

    it("3 solo-interés → +24", () => {
      expect(computeRiskScore({ ...base, soloInteresCount: 3 }, cfg).score).toBe(24);
    });

    it("4 solo-interés → +30 (tope)", () => {
      expect(computeRiskScore({ ...base, soloInteresCount: 4 }, cfg).score).toBe(30);
    });
  });

  describe("Mitigante % capital pagado", () => {
    it("0% pagado → 0 (sin mitigante)", () => {
      expect(computeRiskScore({ ...base, pctPrincipalPaid: 0 }, cfg).score).toBe(0);
    });

    it("25–50% pagado → −5", () => {
      const { score } = computeRiskScore({ ...base, dpd: 16, pctPrincipalPaid: 30 }, cfg);
      expect(score).toBe(30 - 5); // 25 pts DPD, -5 mitigante
    });

    it("50–75% pagado → −10", () => {
      const { score } = computeRiskScore({ ...base, dpd: 16, pctPrincipalPaid: 60 }, cfg);
      expect(score).toBe(30 - 10);
    });

    it(">75% pagado → −15", () => {
      const { score } = computeRiskScore({ ...base, dpd: 16, pctPrincipalPaid: 80 }, cfg);
      expect(score).toBe(30 - 15);
    });

    it("score mínimo es 0 (no baja de cero)", () => {
      const { score } = computeRiskScore({ ...base, pctPrincipalPaid: 80 }, cfg);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("computeRiskScore — niveles", () => {
  const base = {
    dpd: 0,
    lateInstallments: 0,
    soloInteresCount: 0,
    consecutiveSoloInteres: 0,
    pctPrincipalPaid: 0,
  };

  it("score 0 → Verde", () => {
    expect(computeRiskScore(base, cfg).level).toBe("verde");
  });

  it("score 20 → Verde (límite)", () => {
    // 4 atrasos históricos = 20
    expect(computeRiskScore({ ...base, lateInstallments: 4 }, cfg).level).toBe("verde");
  });

  it("score 21 → Amarillo", () => {
    // DPD 1-15 (15) + 1 atraso (5) + 1 solo-interes (8) = 28 → Amarillo
    expect(
      computeRiskScore({ ...base, dpd: 1, lateInstallments: 1, soloInteresCount: 1 }, cfg).level
    ).toBe("amarillo");
  });

  it("score 50 → Amarillo (límite)", () => {
    // DPD 31-60 (50) − 0 = 50
    expect(computeRiskScore({ ...base, dpd: 31 }, cfg).level).toBe("amarillo");
  });

  it("score 51 → Rojo", () => {
    // DPD 31-60 (50) + 1 atraso (5) = 55 → Rojo
    expect(
      computeRiskScore({ ...base, dpd: 31, lateInstallments: 1 }, cfg).level
    ).toBe("rojo");
  });

  it("DPD > 60 → fuerza Rojo independiente del score", () => {
    // Con mitigante podría bajar pero DPD>60 fuerza Rojo
    expect(
      computeRiskScore({ ...base, dpd: 61, pctPrincipalPaid: 90 }, cfg).level
    ).toBe("rojo");
  });

  it("3 solo-interés consecutivos → fuerza Rojo", () => {
    expect(
      computeRiskScore({ ...base, consecutiveSoloInteres: 3 }, cfg).level
    ).toBe("rojo");
  });

  it("2 solo-interés consecutivos → no fuerza Rojo", () => {
    const { level } = computeRiskScore({ ...base, consecutiveSoloInteres: 2 }, cfg);
    expect(level).not.toBe("rojo");
  });
});
