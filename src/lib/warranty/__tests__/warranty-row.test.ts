import { describe, it, expect } from "vitest";
import { addMonths } from "date-fns";
import {
  resolveWarrantyRow,
  matchesStatusFilter,
  type RawWarrantyRow,
} from "../warranty-row";
import { DEFAULT_WARRANTY_MONTHS } from "../warranty-calc";

const base: RawWarrantyRow = {
  deliveredAt: new Date("2026-01-10T00:00:00Z"),
  productWarrantyMonths: null,
  warrantyId: null,
  warrantyStartDate: null,
  warrantyMonths: null,
  warrantyStatus: null,
};

const now = new Date("2026-03-01T00:00:00Z");

describe("resolveWarrantyRow — precedencia de meses de cobertura", () => {
  it("sin garantía materializada ni política del producto, usa el default de la casa", () => {
    const result = resolveWarrantyRow(base, now);
    expect(result.warrantyMonths).toBe(DEFAULT_WARRANTY_MONTHS);
    expect(result.isProvisional).toBe(true);
  });

  it("la política del producto pisa el default", () => {
    const result = resolveWarrantyRow(
      { ...base, productWarrantyMonths: 12 },
      now,
    );
    expect(result.warrantyMonths).toBe(12);
    expect(result.expiryDate.toISOString()).toBe(
      addMonths(new Date("2026-01-10T00:00:00Z"), 12).toISOString(),
    );
  });

  it("el snapshot materializado pisa la política del producto", () => {
    const result = resolveWarrantyRow(
      {
        ...base,
        productWarrantyMonths: 12,
        warrantyId: "w1",
        warrantyMonths: 6,
        warrantyStatus: "active",
      },
      now,
    );
    expect(result.warrantyMonths).toBe(6);
    expect(result.isProvisional).toBe(false);
  });
});

describe("resolveWarrantyRow — fecha de inicio", () => {
  it("sin garantía materializada arranca en la fecha de la venta/apartado", () => {
    const result = resolveWarrantyRow({ ...base, productWarrantyMonths: 6 }, now);
    expect(result.startDate.toISOString()).toBe(
      new Date("2026-01-10T00:00:00Z").toISOString(),
    );
  });

  it("la entrega real corregida por un admin pisa la fecha del documento", () => {
    // Apartado firmado en enero pero entregado en marzo: la garantía corre desde marzo.
    const result = resolveWarrantyRow(
      {
        ...base,
        warrantyId: "w1",
        warrantyStartDate: new Date("2026-03-01T00:00:00Z"),
        warrantyMonths: 3,
        warrantyStatus: "active",
      },
      now,
    );
    expect(result.startDate.toISOString()).toBe(
      new Date("2026-03-01T00:00:00Z").toISOString(),
    );
    expect(result.expiryDate.toISOString()).toBe(
      addMonths(new Date("2026-03-01T00:00:00Z"), 3).toISOString(),
    );
    expect(result.status).toBe("vigente");
  });

  it("acepta timestamps como string, tal como los devuelve el driver", () => {
    const result = resolveWarrantyRow(
      { ...base, deliveredAt: "2026-01-10T00:00:00.000Z", productWarrantyMonths: 6 },
      now,
    );
    expect(result.startDate.toISOString()).toBe(
      new Date("2026-01-10T00:00:00Z").toISOString(),
    );
  });
});

describe("resolveWarrantyRow — anulación", () => {
  it("una garantía anulada no revive aunque las fechas den vigente", () => {
    const result = resolveWarrantyRow(
      {
        ...base,
        warrantyId: "w1",
        warrantyMonths: 24,
        warrantyStatus: "void",
      },
      now,
    );
    expect(result.expiryDate.getTime()).toBeGreaterThan(now.getTime());
    expect(result.status).toBe("sin_cobertura");
  });
});

describe("resolveWarrantyRow — accesorio no serializado", () => {
  it("resuelve igual sin unidad física, usando la política del producto", () => {
    // Unos audífonos vendidos en una línea sin product_item_id.
    const result = resolveWarrantyRow(
      { ...base, productWarrantyMonths: 1 },
      now,
    );
    expect(result.warrantyMonths).toBe(1);
    expect(result.status).toBe("vencida"); // entregados el 10 de enero, 1 mes
  });
});

describe("matchesStatusFilter", () => {
  it("'todas' deja pasar cualquier estado", () => {
    expect(matchesStatusFilter("vigente", "todas")).toBe(true);
    expect(matchesStatusFilter("vencida", "todas")).toBe(true);
    expect(matchesStatusFilter("sin_cobertura", "todas")).toBe(true);
  });

  it("'vigente' solo deja pasar la cobertura activa", () => {
    expect(matchesStatusFilter("vigente", "vigente")).toBe(true);
    expect(matchesStatusFilter("vencida", "vigente")).toBe(false);
    expect(matchesStatusFilter("sin_cobertura", "vigente")).toBe(false);
  });

  it("'vencida' agrupa lo vencido con lo anulado — ninguna de las dos cubre", () => {
    expect(matchesStatusFilter("vencida", "vencida")).toBe(true);
    expect(matchesStatusFilter("sin_cobertura", "vencida")).toBe(true);
    expect(matchesStatusFilter("vigente", "vencida")).toBe(false);
  });
});
