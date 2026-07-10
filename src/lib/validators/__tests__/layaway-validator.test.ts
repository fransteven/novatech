import { describe, it, expect } from "vitest";
import { createLayawaySchema } from "../layaway-validator";

const baseItem = {
  productItemId: null,
  productId: "11111111-1111-4111-8111-111111111111",
  price: 100_000,
  quantity: 1,
  isSerialized: false,
};

const futureDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d;
};

const basePayload = {
  customerId: "22222222-2222-4222-8222-222222222222",
  items: [baseItem],
  totalAmount: 1_000_000,
  expiresAt: futureDate(),
};

describe("createLayawaySchema — crédito", () => {
  it("acepta un crédito válido con plazo y tasa", () => {
    const result = createLayawaySchema.safeParse({
      ...basePayload,
      type: "credito",
      termMonths: 6,
      interestRate: 0.05,
    });
    expect(result.success).toBe(true);
  });

  it("rechaza crédito sin termMonths", () => {
    const result = createLayawaySchema.safeParse({
      ...basePayload,
      type: "credito",
      interestRate: 0.05,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("termMonths"))).toBe(true);
    }
  });

  it("rechaza crédito sin interestRate", () => {
    const result = createLayawaySchema.safeParse({
      ...basePayload,
      type: "credito",
      termMonths: 6,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("interestRate"))).toBe(true);
    }
  });

  it("rechaza crédito con interestRate = 0", () => {
    const result = createLayawaySchema.safeParse({
      ...basePayload,
      type: "credito",
      termMonths: 6,
      interestRate: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rechaza initialDeposit >= totalAmount en crédito", () => {
    const result = createLayawaySchema.safeParse({
      ...basePayload,
      type: "credito",
      termMonths: 6,
      interestRate: 0.05,
      initialDeposit: 1_000_000,
    });
    expect(result.success).toBe(false);
  });
});

describe("createLayawaySchema — sin_interes (no regresión)", () => {
  it("acepta apartado simple sin termMonths ni interestRate", () => {
    const result = createLayawaySchema.safeParse({
      ...basePayload,
      type: "sin_interes",
    });
    expect(result.success).toBe(true);
  });

  it("usa 'sin_interes' como tipo por defecto si no se especifica", () => {
    const result = createLayawaySchema.safeParse(basePayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("sin_interes");
    }
  });
});
