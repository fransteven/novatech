import { describe, expect, it } from "vitest";
import { formatCurrency, formatNumberCO, formatPercentCO, parseCurrencyInput } from "@/lib/formatters";

describe("formatters colombianos", () => {
  it("formatea COP sin centavos y con separador colombiano", () => {
    expect(formatCurrency(0)).toMatch(/\$\s?0/);
    expect(formatCurrency(1_234_567)).toMatch(/1\.234\.567/);
    expect(formatCurrency(-500)).toContain("500");
    expect(formatCurrency(-1_000.5)).toContain("1.001");
  });

  it("normaliza cantidades y tasas para presentación", () => {
    expect(formatNumberCO(1_234_567)).toBe("1.234.567");
    expect(formatPercentCO(0.125)).toContain("12,5");
  });

  it("mantiene los puntos de miles durante escritura y backspace", () => {
    expect(parseCurrencyInput("1")).toBe(1);
    expect(parseCurrencyInput("10")).toBe(10);
    expect(parseCurrencyInput("10.000")).toBe(10_000);
    // Al borrar un cero de 10.000, MoneyInput recibe 10.00 y no debe volverlo 10.
    expect(parseCurrencyInput("10.00")).toBe(1_000);
  });

  it("parsea importes pegados y decimales colombianos", () => {
    expect(parseCurrencyInput("$ 1.234.567")).toBe(1_234_567);
    expect(parseCurrencyInput("1,234,567")).toBe(1_234_567);
    expect(parseCurrencyInput("$\u00a01.234.567")).toBe(1_234_567);
    expect(parseCurrencyInput("1.234,50")).toBe(1_235);
    expect(parseCurrencyInput("1.000,5")).toBe(1_001);
    expect(parseCurrencyInput("1,5")).toBe(2);
    expect(parseCurrencyInput("- 500")).toBe(-500);
    expect(parseCurrencyInput("-1.000,5")).toBe(-1_001);
    expect(parseCurrencyInput("-1,5")).toBe(-2);
    expect(parseCurrencyInput("")).toBeNull();
  });
});
