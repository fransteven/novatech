/**
 * risk-config.ts — Parámetros configurables de la puntuación de riesgo.
 * Cambiar aquí afecta todo el sistema; no hay valores hardcoded en risk.ts.
 */

export interface DpdBucket {
  minDays: number;  // >= minDays
  maxDays: number;  // <= maxDays (Infinity para el último bucket)
  points: number;
}

export interface RiskConfig {
  /** Buckets de días de atraso (DPD) en orden ascendente. */
  dpdBuckets: DpdBucket[];
  /** Puntos por cada cuota pagada con retraso (histórico). */
  lateInstallmentPoints: number;
  /** Tope máximo de puntos por atrasos históricos. */
  lateInstallmentCap: number;
  /** Puntos por cada pago de solo-interés. */
  soloInteresPoints: number;
  /** Tope máximo de puntos por pagos solo-interés. */
  soloInteresCap: number;
  /** Cuántos pagos solo-interés consecutivos disparan nivel Rojo. */
  consecutiveSoloInteresThreshold: number;
  /** DPD a partir del cual se fuerza nivel Rojo independiente del score. */
  dpdForceRedThreshold: number;
  /** Mitigantes por % de capital ya pagado. */
  principalPaidMitigants: Array<{
    minPct: number;   // > minPct
    maxPct: number;   // <= maxPct (100 para el último)
    points: number;   // negativo (reduce el score)
  }>;
  /** Fronteras de nivel: score <= threshold → ese nivel. */
  levels: {
    verde: number;    // 0 – verde (inclusive)
    amarillo: number; // verde+1 – amarillo (inclusive)
    // rojo: todo lo mayor
  };
}

export const DEFAULT_RISK_CONFIG: RiskConfig = {
  dpdBuckets: [
    { minDays: 0, maxDays: 0, points: 0 },
    { minDays: 1, maxDays: 15, points: 15 },
    { minDays: 16, maxDays: 30, points: 30 },
    { minDays: 31, maxDays: 60, points: 50 },
    { minDays: 61, maxDays: Infinity, points: 70 },
  ],
  lateInstallmentPoints: 5,
  lateInstallmentCap: 25,
  soloInteresPoints: 8,
  soloInteresCap: 30,
  consecutiveSoloInteresThreshold: 3,
  dpdForceRedThreshold: 60,
  principalPaidMitigants: [
    { minPct: 25, maxPct: 50, points: -5 },
    { minPct: 50, maxPct: 75, points: -10 },
    { minPct: 75, maxPct: 100, points: -15 },
  ],
  levels: {
    verde: 20,
    amarillo: 50,
  },
};
