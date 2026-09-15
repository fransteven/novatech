import { describe, expect, it } from "vitest";

import { getInstallmentVisual } from "@/lib/installment-status";

const now = new Date("2026-09-15T12:00:00");

describe("getInstallmentVisual", () => {
  it("marca pagada cuando el estado es pagada", () => {
    const v = getInstallmentVisual({
      status: "pagada",
      dueDate: "2026-08-01",
      totalAmount: 100,
      paidAmount: 100,
      now,
    });
    expect(v.state).toBe("pagada");
    expect(v.hint).toBe("");
  });

  it("marca pagada cuando el abono cubre la cuota aunque el estado siga pendiente", () => {
    const v = getInstallmentVisual({
      status: "pendiente",
      dueDate: "2026-10-01",
      totalAmount: 100,
      paidAmount: 100,
      now,
    });
    expect(v.state).toBe("pagada");
  });

  it("marca vencida cuando la fecha ya pasó y no está cubierta", () => {
    const v = getInstallmentVisual({
      status: "pendiente",
      dueDate: "2026-09-11T00:00:00",
      totalAmount: 100,
      paidAmount: 0,
      now,
    });
    expect(v.state).toBe("vencida");
    expect(v.hint).toBe("hace 4 días");
  });

  it("distingue vencida con abono parcial", () => {
    const v = getInstallmentVisual({
      status: "vencida",
      dueDate: "2026-09-01T00:00:00",
      totalAmount: 100,
      paidAmount: 40,
      now,
    });
    expect(v.state).toBe("vencida");
    expect(v.label).toBe("Vencida · abonada");
    expect(v.progress).toBe(40);
  });

  it("marca parcial cuando hay abono y aún no vence", () => {
    const v = getInstallmentVisual({
      status: "pendiente",
      dueDate: "2026-10-15T00:00:00",
      totalAmount: 200,
      paidAmount: 50,
      now,
    });
    expect(v.state).toBe("parcial");
    expect(v.label).toBe("Abonada 25%");
  });

  it("marca por vencer dentro de la ventana de 7 días", () => {
    const hoy = getInstallmentVisual({
      status: "pendiente",
      dueDate: "2026-09-15T00:00:00",
      totalAmount: 100,
      now,
    });
    expect(hoy.state).toBe("por_vencer");
    expect(hoy.label).toBe("Vence hoy");

    const enTres = getInstallmentVisual({
      status: "pendiente",
      dueDate: "2026-09-18T00:00:00",
      totalAmount: 100,
      now,
    });
    expect(enTres.state).toBe("por_vencer");
    expect(enTres.hint).toBe("en 3 días");
  });

  it("marca pendiente cuando falta más de una semana", () => {
    const v = getInstallmentVisual({
      status: "pendiente",
      dueDate: "2026-11-01T00:00:00",
      totalAmount: 100,
      now,
    });
    expect(v.state).toBe("pendiente");
    expect(v.progress).toBe(0);
  });
});
