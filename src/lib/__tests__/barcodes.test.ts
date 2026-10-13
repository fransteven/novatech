import { describe, expect, it } from "vitest";
import { inferBarcodeKind, normalizeBarcode, uniqueBarcodes } from "@/lib/barcodes";

describe("barcodes", () => {
  it("normaliza espacios y mayúsculas", () => {
    expect(normalizeBarcode("  f1641522j33 pmg9dw\n")).toBe("F1641522J33PMG9DW");
  });

  it("infiere UPC/EAN por longitud numérica", () => {
    expect(inferBarcodeKind("195950665963")).toBe("upc");
    expect(inferBarcodeKind("1959506659631")).toBe("upc");
    expect(inferBarcodeKind("F16HKE0051F0000NXY")).toBe("serial");
    expect(inferBarcodeKind("12345")).toBe("serial");
  });

  it("deduplica códigos repetidos entre cajas", () => {
    expect(
      uniqueBarcodes(["F1641522J33PMG9DW", "f1641522j33pmg9dw", " ", "195950665963"]),
    ).toEqual(["F1641522J33PMG9DW", "195950665963"]);
  });
});
