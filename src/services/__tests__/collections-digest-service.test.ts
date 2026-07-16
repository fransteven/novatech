import { describe, it, expect } from "vitest";
import { classify } from "../collections-digest-service";

describe("classify (digest de cobros)", () => {
  const today = new Date("2026-07-14T00:00:00.000Z");

  it("fecha pasada → mora", () => {
    expect(classify(new Date("2026-07-10T00:00:00.000Z"), today)).toBe("mora");
    expect(classify(new Date("2026-07-13T00:00:00.000Z"), today)).toBe("mora");
  });

  it("fecha de hoy → hoy", () => {
    expect(classify(new Date("2026-07-14T15:00:00.000Z"), today)).toBe("hoy");
  });

  it("dentro de los próximos 3 días → porVencer", () => {
    expect(classify(new Date("2026-07-15T00:00:00.000Z"), today)).toBe("porVencer");
    expect(classify(new Date("2026-07-17T00:00:00.000Z"), today)).toBe("porVencer");
  });

  it("más de 3 días en el futuro → fuera", () => {
    expect(classify(new Date("2026-07-18T00:00:00.000Z"), today)).toBe("fuera");
    expect(classify(new Date("2026-08-01T00:00:00.000Z"), today)).toBe("fuera");
  });
});
