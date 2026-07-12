import { describe, it, expect } from "vitest";
import { computeWarrantyExpiry, DEFAULT_WARRANTY_MONTHS } from "../warranty-calc";

describe("computeWarrantyExpiry", () => {
  it("marca VIGENTE cuando hoy está antes del vencimiento", () => {
    const startDate = new Date("2026-01-01T00:00:00Z");
    const now = new Date("2026-03-01T00:00:00Z"); // 2 meses después
    const result = computeWarrantyExpiry(startDate, 12, now);

    expect(result.status).toBe("vigente");
    expect(result.expiryDate.toISOString()).toBe(
      new Date("2027-01-01T00:00:00Z").toISOString(),
    );
    expect(result.daysRemaining).toBeGreaterThan(0);
  });

  it("marca VENCIDA cuando hoy es posterior al vencimiento", () => {
    const startDate = new Date("2025-01-01T00:00:00Z");
    const now = new Date("2026-06-01T00:00:00Z"); // 17 meses después, garantía de 12
    const result = computeWarrantyExpiry(startDate, 12, now);

    expect(result.status).toBe("vencida");
    expect(result.daysRemaining).toBeLessThan(0);
  });

  it("borde exacto: el día del vencimiento aún cuenta como VIGENTE", () => {
    const startDate = new Date("2026-01-01T00:00:00Z");
    const expiry = new Date("2026-04-01T00:00:00Z"); // 3 meses (garantía por defecto)
    const result = computeWarrantyExpiry(startDate, DEFAULT_WARRANTY_MONTHS, expiry);

    expect(result.status).toBe("vigente");
    expect(result.daysRemaining).toBe(0);
  });

  it("un día después del vencimiento exacto ya es VENCIDA", () => {
    const startDate = new Date("2026-01-01T00:00:00Z");
    const now = new Date("2026-04-02T00:00:00Z"); // 1 día después de vencer (3 meses)
    const result = computeWarrantyExpiry(startDate, DEFAULT_WARRANTY_MONTHS, now);

    expect(result.status).toBe("vencida");
    expect(result.daysRemaining).toBe(-1);
  });

  it("respeta la entrega como punto de partida, no la fecha de venta", () => {
    // Simula un apartado: la venta se liquida meses después de la entrega,
    // pero la garantía debe correr desde que el equipo salió (startDate).
    const deliveredAt = new Date("2026-01-15T00:00:00Z");
    const liquidatedAt = new Date("2026-04-15T00:00:00Z"); // irrelevante aquí
    const now = new Date("2026-03-01T00:00:00Z");

    const result = computeWarrantyExpiry(deliveredAt, 1, now);

    expect(result.status).toBe("vencida"); // ya pasó 1 mes desde la entrega
    expect(result.expiryDate < liquidatedAt).toBe(true);
  });
});
