const currencyFormatter = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const numberFormatter = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const percentFormatter = new Intl.NumberFormat("es-CO", { style: "percent", maximumFractionDigits: 1 });

const toFiniteNumber = (value: number | string | null | undefined) => {
  const numeric = typeof value === "string" ? Number(value) : value;
  return typeof numeric === "number" && Number.isFinite(numeric) ? numeric : 0;
};

/** Redondeo HALF_UP simétrico: -1.5 pasa a -2, igual que 1.5 pasa a 2. */
const roundCOP = (value: number) => Math.sign(value) * Math.round(Math.abs(value));

/** Formato de importes operativos en pesos colombianos, siempre sin centavos. */
export const formatCurrency = (value: number | string | null | undefined) => currencyFormatter.format(roundCOP(toFiniteNumber(value)));

export const formatNumberCO = (value: number | string | null | undefined) => numberFormatter.format(toFiniteNumber(value));

/** Recibe una tasa decimal: 0.125 se muestra como 12,5 %. */
export const formatPercentCO = (value: number | string | null | undefined) => percentFormatter.format(toFiniteNumber(value));

/**
 * Lee COP mientras se escribe: el punto siempre es separador de miles, pues es
 * el formato que MoneyInput vuelve a pintar. La coma única admite decimales
 * colombianos; varias comas se interpretan como agrupación de un valor pegado.
 */
export const parseCurrencyInput = (raw: string): number | null => {
  const normalized = raw.replace(/[\s$\u00a0]/g, "").replace(/[^\d,.-]/g, "");
  if (!normalized || normalized === "-" || normalized === "," || normalized === ".") return null;
  const sign = normalized.startsWith("-") ? -1 : 1;
  const unsigned = normalized.replace(/-/g, "");
  const commaIndex = unsigned.lastIndexOf(",");
  const commaCount = unsigned.split(",").length - 1;
  const decimalDigits = commaIndex < 0 ? 0 : unsigned.length - commaIndex - 1;
  const decimalPart = commaIndex < 0 ? "" : unsigned.slice(commaIndex + 1);
  const hasColombianDecimal = commaCount === 1 && /^\d{1,2}$/.test(decimalPart) && decimalDigits > 0;

  const numericText = hasColombianDecimal
    ? `${unsigned.slice(0, commaIndex).replace(/[.,]/g, "")}.${decimalPart}`
    : unsigned.replace(/[.,]/g, "");
  const parsed = Number(numericText);
  if (!Number.isFinite(parsed)) return null;
  const rounded = sign * Math.round(Math.abs(parsed));
  return Number.isSafeInteger(rounded) ? rounded : null;
};
