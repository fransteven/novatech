import { describe, it, expect } from "vitest";
import {
  allocateExtraCosts,
  derivePaymentStatus,
} from "@/lib/purchase-costs";
import { findDuplicateSerials, normalizeSerial } from "@/lib/serials";

const sumUnits = (result: ReturnType<typeof allocateExtraCosts>) =>
  result.lines.reduce(
    (acc, line) =>
      acc + line.landedUnitCosts.reduce((lineAcc, cost) => lineAcc + cost, 0),
    0,
  );

describe("allocateExtraCosts", () => {
  it("sin costos adicionales el costo aterrizado es el de factura", () => {
    const result = allocateExtraCosts(
      [
        { quantity: 2, unitCost: 1000 },
        { quantity: 1, unitCost: 500 },
      ],
      0,
    );

    expect(result.subtotal).toBe(2500);
    expect(result.total).toBe(2500);
    expect(result.lines[0].landedUnitCost).toBe(1000);
    expect(result.lines[1].landedUnitCost).toBe(500);
  });

  it("prorratea proporcional al valor de cada línea", () => {
    const result = allocateExtraCosts(
      [
        { quantity: 1, unitCost: 3000 },
        { quantity: 1, unitCost: 1000 },
      ],
      400,
    );

    // 3000/4000 = 75% de 400 = 300 ; 1000/4000 = 25% = 100
    expect(result.lines[0].extraShare).toBe(300);
    expect(result.lines[1].extraShare).toBe(100);
    expect(result.lines[0].landedUnitCost).toBe(3300);
    expect(result.lines[1].landedUnitCost).toBe(1100);
    expect(result.total).toBe(4400);
  });

  it("no pierde ni inventa pesos cuando el reparto no es exacto", () => {
    const result = allocateExtraCosts(
      [
        { quantity: 3, unitCost: 1000 },
        { quantity: 1, unitCost: 1000 },
        { quantity: 1, unitCost: 1000 },
      ],
      100,
    );

    expect(sumUnits(result)).toBeCloseTo(result.total, 2);
    expect(result.total).toBe(5100);
    // Cada línea recibió su parte y la suma de partes es el total de extras
    const shares = result.lines.reduce((acc, line) => acc + line.extraShare, 0);
    expect(shares).toBe(100);
  });

  it("reparte el residuo entre las unidades de una línea serializada", () => {
    const result = allocateExtraCosts([{ quantity: 3, unitCost: 1000 }], 10);

    expect(result.lines[0].landedUnitCosts).toHaveLength(3);
    expect(sumUnits(result)).toBeCloseTo(3010, 2);
  });

  it("con subtotal en 0 no divide por cero y reparte parejo", () => {
    const result = allocateExtraCosts(
      [
        { quantity: 1, unitCost: 0 },
        { quantity: 1, unitCost: 0 },
      ],
      100,
    );

    expect(result.subtotal).toBe(0);
    expect(result.total).toBe(100);
    expect(sumUnits(result)).toBeCloseTo(100, 2);
  });

  it("ignora costos adicionales negativos", () => {
    const result = allocateExtraCosts([{ quantity: 1, unitCost: 1000 }], -50);
    expect(result.total).toBe(1000);
    expect(result.lines[0].landedUnitCost).toBe(1000);
  });
});

describe("derivePaymentStatus", () => {
  it("sin abono la compra queda a crédito", () => {
    expect(derivePaymentStatus(0, 1000)).toBe("pending");
  });

  it("abono menor al total es parcial", () => {
    expect(derivePaymentStatus(400, 1000)).toBe("partial");
  });

  it("abono igual o mayor al total es pagada", () => {
    expect(derivePaymentStatus(1000, 1000)).toBe("paid");
    expect(derivePaymentStatus(1200, 1000)).toBe("paid");
  });

  it("no se confunde con decimales de punto flotante", () => {
    expect(derivePaymentStatus(0.1 + 0.2, 0.3)).toBe("paid");
  });
});

describe("seriales", () => {
  it("normaliza espacios y mayúsculas", () => {
    expect(normalizeSerial("  imei 123 ")).toBe("IMEI123");
  });

  it("detecta repetidos ignorando formato", () => {
    expect(findDuplicateSerials(["abc123", "ABC 123", "xyz"])).toEqual([
      "ABC123",
    ]);
  });

  it("no reporta duplicados cuando todos son distintos", () => {
    expect(findDuplicateSerials(["a1", "b2", "c3"])).toEqual([]);
  });

  it("ignora vacíos", () => {
    expect(findDuplicateSerials(["", "  ", ""])).toEqual([]);
  });
});
