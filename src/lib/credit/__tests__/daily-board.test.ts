import { describe, it, expect } from "vitest";
import { buildCreditBoard, bogotaDayDiff, whatsappLink, type OpenInstallment } from "../daily-board";

// 2026-10-01 10:00 en Bogotá
const NOW = new Date("2026-10-01T15:00:00Z");

const inst = (layawayId: string, number: number, dueIso: string, total = 100, paid = 0): OpenInstallment => ({
  layawayId,
  number,
  dueDate: new Date(dueIso),
  totalAmount: total,
  paidAmount: paid,
});

describe("bogotaDayDiff", () => {
  it("cuenta días en calendario de Bogotá, no UTC", () => {
    // 02:00 UTC del 2 de octubre = 21:00 del 1 de octubre en Bogotá
    expect(bogotaDayDiff(NOW, new Date("2026-10-02T02:00:00Z"))).toBe(0);
    expect(bogotaDayDiff(NOW, new Date("2026-10-02T06:00:00Z"))).toBe(1);
    expect(bogotaDayDiff(NOW, new Date("2026-09-30T23:00:00Z"))).toBe(-1);
  });
});

describe("buildCreditBoard", () => {
  it("clasifica hoy, mora y próximos, y descarta lo lejano", () => {
    const board = buildCreditBoard(
      [
        inst("hoy", 1, "2026-10-01T20:00:00Z"),
        inst("mora", 1, "2026-09-20T15:00:00Z"),
        inst("prox", 2, "2026-10-03T15:00:00Z"),
        inst("lejos", 1, "2026-10-10T15:00:00Z"),
      ],
      NOW,
    );
    const byId = Object.fromEntries(board.map((e) => [e.layawayId, e]));
    expect(byId.hoy.bucket).toBe("hoy");
    expect(byId.mora.bucket).toBe("mora");
    expect(byId.mora.daysLate).toBe(11);
    expect(byId.prox.bucket).toBe("proximos");
    expect(byId.prox.daysToDue).toBe(2);
    expect(byId.lejos).toBeUndefined();
  });

  it("agrupa cuotas vencidas + la de hoy en un solo renglón y descuenta abonos", () => {
    const [entry] = buildCreditBoard(
      [
        inst("c1", 3, "2026-10-01T15:00:00Z", 100),
        inst("c1", 1, "2026-08-01T15:00:00Z", 100, 40),
        inst("c1", 2, "2026-09-01T15:00:00Z", 100),
        inst("c1", 4, "2026-11-01T15:00:00Z", 100),
      ],
      NOW,
    );
    expect(entry.bucket).toBe("mora");
    expect(entry.installments).toEqual([1, 2, 3]);
    expect(entry.amountDue).toBe(260);
    expect(entry.daysLate).toBe(61);
  });

  it("ignora cuotas ya cubiertas por abonos", () => {
    const board = buildCreditBoard([inst("c1", 1, "2026-09-01T15:00:00Z", 100, 100)], NOW);
    expect(board).toHaveLength(0);
  });

  it("ordena la mora por días de atraso descendente", () => {
    const board = buildCreditBoard(
      [inst("a", 1, "2026-09-28T15:00:00Z"), inst("b", 1, "2026-09-01T15:00:00Z")],
      NOW,
    );
    expect(board.map((e) => e.layawayId)).toEqual(["b", "a"]);
  });
});

describe("whatsappLink", () => {
  it("agrega indicativo 57 a celulares locales", () => {
    expect(whatsappLink("310 123 4567")).toBe("https://wa.me/573101234567");
    expect(whatsappLink("+57 310-123-4567")).toBe("https://wa.me/573101234567");
    expect(whatsappLink("123")).toBeNull();
    expect(whatsappLink(null)).toBeNull();
  });
});
