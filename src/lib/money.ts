/**
 * money.ts — Wrapper de decimal.js para aritmética monetaria exacta.
 * Moneda: COP (pesos colombianos). Redondeo: HALF_UP a enteros.
 * NUNCA usar float nativo para cálculos de crédito/interés.
 */

import Decimal from "decimal.js";

// Configuración global: HALF_UP, máximo 20 dígitos de precisión
Decimal.set({ rounding: Decimal.ROUND_HALF_UP, precision: 20 });

export type MoneyValue = Decimal | string | number;

/** Construye un Decimal desde cualquier fuente. */
export const money = (value: MoneyValue): Decimal => new Decimal(value);

/** Redondea a pesos enteros (0 decimales) con HALF_UP. */
export const roundCOP = (value: MoneyValue): Decimal =>
  money(value).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

/** Suma dos valores monetarios. */
export const add = (a: MoneyValue, b: MoneyValue): Decimal =>
  money(a).plus(money(b));

/** Resta b de a. */
export const sub = (a: MoneyValue, b: MoneyValue): Decimal =>
  money(a).minus(money(b));

/** Multiplica a por b. */
export const mul = (a: MoneyValue, b: MoneyValue): Decimal =>
  money(a).times(money(b));

/** Divide a entre b. */
export const div = (a: MoneyValue, b: MoneyValue): Decimal =>
  money(a).dividedBy(money(b));

/**
 * Convierte a string con 2 decimales para columnas decimal(_,2) de Drizzle.
 * Ej. 1_234_500 → "1234500.00"
 */
export const toDbString = (value: MoneyValue): string =>
  roundCOP(value).toFixed(2);

/** Convierte a número JS (solo para display / devolución al cliente). */
export const toNumber = (value: MoneyValue): number =>
  money(value).toNumber();

/** Retorna true si a === b. */
export const eq = (a: MoneyValue, b: MoneyValue): boolean =>
  money(a).equals(money(b));

/** Retorna true si a > b. */
export const gt = (a: MoneyValue, b: MoneyValue): boolean =>
  money(a).greaterThan(money(b));

/** Retorna true si a >= b. */
export const gte = (a: MoneyValue, b: MoneyValue): boolean =>
  money(a).greaterThanOrEqualTo(money(b));

/** Retorna true si a < b. */
export const lt = (a: MoneyValue, b: MoneyValue): boolean =>
  money(a).lessThan(money(b));

/** Retorna true si a <= b. */
export const lte = (a: MoneyValue, b: MoneyValue): boolean =>
  money(a).lessThanOrEqualTo(money(b));
