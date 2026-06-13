/**
 * risk.ts — Cálculo de score de riesgo crediticio.
 * Pura: sin DB, sin side-effects. Recibe factores, retorna { score, level }.
 */

import type { RiskConfig } from "./risk-config";

export type RiskLevel = "verde" | "amarillo" | "rojo";

export interface RiskFactors {
  /** Días de atraso actuales (DPD = days past due). */
  dpd: number;
  /** Cantidad histórica de cuotas pagadas con retraso. */
  lateInstallments: number;
  /** Total de pagos de solo-interés en toda la vida del crédito. */
  soloInteresCount: number;
  /** Pagos de solo-interés consecutivos más recientes. */
  consecutiveSoloInteres: number;
  /** Porcentaje del capital original ya pagado (0–100). */
  pctPrincipalPaid: number;
}

export interface RiskResult {
  score: number;
  level: RiskLevel;
}

export function computeRiskScore(
  factors: RiskFactors,
  config: RiskConfig
): RiskResult {
  let score = 0;

  // 1. Puntos por DPD
  const bucket = config.dpdBuckets.find(
    (b) => factors.dpd >= b.minDays && factors.dpd <= b.maxDays
  );
  if (bucket) score += bucket.points;

  // 2. Puntos por atrasos históricos (tope)
  score += Math.min(
    factors.lateInstallments * config.lateInstallmentPoints,
    config.lateInstallmentCap
  );

  // 3. Puntos por pagos de solo-interés (tope)
  score += Math.min(
    factors.soloInteresCount * config.soloInteresPoints,
    config.soloInteresCap
  );

  // 4. Mitigante por % capital pagado
  const mitigant = config.principalPaidMitigants.find(
    (m) =>
      factors.pctPrincipalPaid > m.minPct &&
      factors.pctPrincipalPaid <= m.maxPct
  );
  if (mitigant) score += mitigant.points;

  // Score mínimo 0
  score = Math.max(0, score);

  // 5. Determinar nivel
  let level: RiskLevel;

  const forceRed =
    factors.dpd > config.dpdForceRedThreshold ||
    factors.consecutiveSoloInteres >= config.consecutiveSoloInteresThreshold;

  if (forceRed || score > config.levels.amarillo) {
    level = "rojo";
  } else if (score > config.levels.verde) {
    level = "amarillo";
  } else {
    level = "verde";
  }

  return { score, level };
}
