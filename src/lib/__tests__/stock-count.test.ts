import { describe, expect, it } from "vitest";
import {
  findCountProblems,
  formatInternalCode,
  isUpcCandidate,
  nextInternalCode,
} from "@/lib/stock-count";

describe("internal codes", () => {
  it("formats with 6 digits", () => {
    expect(formatInternalCode(1)).toBe("INT-000001");
    expect(formatInternalCode(1234567)).toBe("INT-1234567");
  });

  it("starts at 1 and ignores non-internal codes", () => {
    expect(nextInternalCode([])).toBe("INT-000001");
    expect(nextInternalCode(["7501234567890", "SN123"])).toBe("INT-000001");
  });

  it("continues from the highest consecutive", () => {
    expect(nextInternalCode(["INT-000002", "INT-000010", "INT-000003"])).toBe(
      "INT-000011",
    );
  });
});

describe("isUpcCandidate", () => {
  it("accepts 8 to 14 digits only", () => {
    expect(isUpcCandidate("711719541028")).toBe(true);
    expect(isUpcCandidate("12345678")).toBe(true);
    expect(isUpcCandidate("1234567")).toBe(false);
    expect(isUpcCandidate("INT-000001")).toBe(false);
  });
});

describe("findCountProblems", () => {
  const base = {
    productName: "Control DualSense",
    isSerialized: false,
    quantity: 2,
    unitCost: "150000",
    serials: null,
  };

  it("rejects an empty count", () => {
    expect(findCountProblems([])).toHaveLength(1);
  });

  it("passes a costed non-serialized line", () => {
    expect(findCountProblems([base])).toEqual([]);
  });

  it("accepts zero cost but not a missing one", () => {
    expect(findCountProblems([{ ...base, unitCost: 0 }])).toEqual([]);
    expect(findCountProblems([{ ...base, unitCost: null }])).toEqual([
      "Control DualSense: falta el costo.",
    ]);
  });

  it("requires one serial per serialized unit", () => {
    const line = { ...base, isSerialized: true, serials: ["SN1"] };
    expect(findCountProblems([line])).toHaveLength(1);
    expect(findCountProblems([{ ...line, serials: ["SN1", "SN2"] }])).toEqual([]);
  });
});
