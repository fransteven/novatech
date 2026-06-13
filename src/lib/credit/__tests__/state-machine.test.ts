import { describe, it, expect } from "vitest";
import { canTransition, assertTransition, VALID_TRANSITIONS } from "../state-machine";

describe("canTransition", () => {
  it("cotizacion → active: permitida", () => {
    expect(canTransition("cotizacion", "active")).toBe(true);
  });

  it("active → completed: permitida", () => {
    expect(canTransition("active", "completed")).toBe(true);
  });

  it("active → cancelled: permitida", () => {
    expect(canTransition("active", "cancelled")).toBe(true);
  });

  it("active → defaulted: permitida", () => {
    expect(canTransition("active", "defaulted")).toBe(true);
  });

  it("completed → active: prohibida", () => {
    expect(canTransition("completed", "active")).toBe(false);
  });

  it("cancelled → active: prohibida", () => {
    expect(canTransition("cancelled", "active")).toBe(false);
  });

  it("cancelled → completed: prohibida", () => {
    expect(canTransition("cancelled", "completed")).toBe(false);
  });

  it("defaulted → active: prohibida", () => {
    expect(canTransition("defaulted", "active")).toBe(false);
  });

  it("completed → completed (mismo estado): prohibida", () => {
    expect(canTransition("completed", "completed")).toBe(false);
  });
});

describe("assertTransition", () => {
  it("no lanza para transición válida", () => {
    expect(() => assertTransition("cotizacion", "active")).not.toThrow();
  });

  it("lanza para transición inválida con mensaje claro", () => {
    expect(() => assertTransition("cancelled", "active")).toThrow(
      /transición/i
    );
  });

  it("lanza si se intenta registrar pago en estado completed", () => {
    // El servicio llama assertTransition antes de procesar pago
    expect(() => assertTransition("completed", "active")).toThrow();
  });

  it("lanza si se intenta registrar pago en estado cancelled", () => {
    expect(() => assertTransition("cancelled", "active")).toThrow();
  });
});

describe("VALID_TRANSITIONS exhaustive coverage", () => {
  it("todo estado tiene al menos una transición saliente (excepto terminales)", () => {
    const terminalStates = ["completed", "cancelled", "defaulted"];
    const nonTerminal = Object.keys(VALID_TRANSITIONS).filter(
      (s) => !terminalStates.includes(s)
    );
    nonTerminal.forEach((state) => {
      expect(
        VALID_TRANSITIONS[state as keyof typeof VALID_TRANSITIONS].length
      ).toBeGreaterThan(0);
    });
  });
});
