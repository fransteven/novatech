import { describe, expect, it } from "vitest";
import {
  getConditionAttributes,
  pickConditionDetails,
} from "@/lib/condition-attributes";

describe("getConditionAttributes", () => {
  it("pide salud de batería en categorías con batería", () => {
    for (const category of [
      "Smartphones",
      "Tablets",
      "Laptops",
      "Smartwatches",
      "Audífonos",
    ]) {
      expect(getConditionAttributes(category).map((a) => a.key)).toEqual([
        "batteryHealth",
      ]);
    }
  });

  it("no pide batería en consolas ni accesorios", () => {
    expect(getConditionAttributes("Consolas")).toEqual([]);
    expect(getConditionAttributes("Accesorios")).toEqual([]);
  });

  it("sin categoría no pide métricas extra", () => {
    expect(getConditionAttributes(null)).toEqual([]);
    expect(getConditionAttributes(undefined)).toEqual([]);
  });
});

describe("pickConditionDetails", () => {
  it("conserva la métrica válida para la categoría", () => {
    expect(
      pickConditionDetails({ batteryHealth: 88 }, "Smartphones"),
    ).toEqual({ batteryHealth: 88 });
  });

  it("descarta la métrica que no aplica a la categoría", () => {
    expect(pickConditionDetails({ batteryHealth: 88 }, "Consolas")).toBeNull();
  });

  it("vacío o nulo no viaja al servidor", () => {
    expect(pickConditionDetails({ batteryHealth: "" }, "Tablets")).toBeNull();
    expect(pickConditionDetails(null, "Tablets")).toBeNull();
  });
});
