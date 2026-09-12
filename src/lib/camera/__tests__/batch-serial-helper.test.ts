import { describe, it, expect } from "vitest";
import { processBatchSerial } from "../batch-serial-helper";

describe("processBatchSerial pure helper", () => {
  it("should normalize and fill the first empty slot in the batch", () => {
    const result = processBatchSerial({
      scannedValue: "  abc-12345  ",
      currentSerials: ["EXISTING1", "", ""],
      targetQuantity: 3,
    });

    expect(result.decision.status).toBe("accepted");
    if (result.decision.status === "accepted") {
      expect(result.decision.complete).toBe(false);
    }
    expect(result.filledIndex).toBe(1);
    expect(result.nextSerials[1]).toBe("ABC-12345");
    expect(result.isComplete).toBe(false);
  });

  it("should detect when batch becomes complete on filling last empty slot", () => {
    const result = processBatchSerial({
      scannedValue: "SERIAL3",
      currentSerials: ["SERIAL1", "SERIAL2", ""],
      targetQuantity: 3,
    });

    expect(result.decision.status).toBe("accepted");
    if (result.decision.status === "accepted") {
      expect(result.decision.complete).toBe(true);
    }
    expect(result.filledIndex).toBe(2);
    expect(result.nextSerials[2]).toBe("SERIAL3");
    expect(result.isComplete).toBe(true);
  });

  it("should reject duplicate serial already present in the current batch", () => {
    const result = processBatchSerial({
      scannedValue: "serial1",
      currentSerials: ["SERIAL1", "", ""],
      targetQuantity: 3,
    });

    expect(result.decision.status).toBe("rejected");
    if (result.decision.status === "rejected") {
      expect(result.decision.message).toContain('El serial "SERIAL1" ya está en este lote');
    }
    expect(result.filledIndex).toBe(-1);
    expect(result.isComplete).toBe(false);
  });

  it("should reject duplicate serial present in existing external set", () => {
    const existingSet = new Set(["PREVIOUS_LINE_SERIAL"]);
    const result = processBatchSerial({
      scannedValue: "PREVIOUS_LINE_SERIAL",
      currentSerials: ["", ""],
      targetQuantity: 2,
      existingSerialsSet: existingSet,
    });

    expect(result.decision.status).toBe("rejected");
    if (result.decision.status === "rejected") {
      expect(result.decision.message).toContain("ya está registrado en la compra");
    }
    expect(result.filledIndex).toBe(-1);
  });

  it("should support targeting a specific index", () => {
    const result = processBatchSerial({
      scannedValue: "REPLACED_SERIAL",
      currentSerials: ["SERIAL1", "OLD_SERIAL", "SERIAL3"],
      targetQuantity: 3,
      targetIndex: 1,
    });

    expect(result.decision.status).toBe("accepted");
    expect(result.filledIndex).toBe(1);
    expect(result.nextSerials[1]).toBe("REPLACED_SERIAL");
    expect(result.isComplete).toBe(true);
  });

  it("should reject when batch is already full and no targetIndex is provided", () => {
    const result = processBatchSerial({
      scannedValue: "EXTRA_SERIAL",
      currentSerials: ["S1", "S2", "S3"],
      targetQuantity: 3,
    });

    expect(result.decision.status).toBe("rejected");
    if (result.decision.status === "rejected") {
      expect(result.decision.message).toContain("Lote completo");
    }
    expect(result.isComplete).toBe(true);
  });

  it("should reject empty or whitespace-only inputs", () => {
    const result = processBatchSerial({
      scannedValue: "   ",
      currentSerials: ["", ""],
      targetQuantity: 2,
    });

    expect(result.decision.status).toBe("rejected");
    if (result.decision.status === "rejected") {
      expect(result.decision.message).toContain("Serial vacío");
    }
  });
});
