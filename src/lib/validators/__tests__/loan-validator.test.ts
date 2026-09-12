import { describe, it, expect } from "vitest";
import {
  createLoanSchema,
  registerLoanPaymentSchema,
  writeOffLoanSchema,
} from "../loan-validator";

const futureDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d;
};

const pastDate = () => {
  const d = new Date();
  d.setDate(d.getDate() - 5);
  return d;
};

const baseLoanPayload = {
  customerId: "11111111-1111-4111-8111-111111111111",
  principalAmount: 1_000_000,
  termMonths: 6,
  interestRate: 0.05,
  accountId: "22222222-2222-4222-8222-222222222222",
  paymentMethod: "cash" as const,
  firstDueDate: futureDate(),
  idempotencyKey: "33333333-3333-4333-8333-333333333333",
};

describe("createLoanSchema", () => {
  it("acepta un préstamo válido con tasa y plazo", () => {
    const result = createLoanSchema.safeParse(baseLoanPayload);
    expect(result.success).toBe(true);
  });

  it("rechaza si falta interestRate (sin fallback silencioso)", () => {
    const { interestRate, ...withoutRate } = baseLoanPayload;
    const result = createLoanSchema.safeParse(withoutRate);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("interestRate"))).toBe(true);
    }
  });

  it("rechaza si interestRate es 0 o negativo", () => {
    const resultZero = createLoanSchema.safeParse({ ...baseLoanPayload, interestRate: 0 });
    expect(resultZero.success).toBe(false);

    const resultNeg = createLoanSchema.safeParse({ ...baseLoanPayload, interestRate: -0.05 });
    expect(resultNeg.success).toBe(false);
  });

  it("acepta tasas altas sin tope de usura (ej. 30% mensual)", () => {
    const result = createLoanSchema.safeParse({ ...baseLoanPayload, interestRate: 0.3 });
    expect(result.success).toBe(true);
  });

  it("rechaza si la tasa mensual supera 100% (> 1.0)", () => {
    const result = createLoanSchema.safeParse({ ...baseLoanPayload, interestRate: 1.5 });
    expect(result.success).toBe(false);
  });

  it("rechaza si la primera fecha de cuota está en el pasado", () => {
    const result = createLoanSchema.safeParse({
      ...baseLoanPayload,
      firstDueDate: pastDate(),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("firstDueDate"))).toBe(true);
    }
  });

  it("acepta comisión de originación opcional", () => {
    const result = createLoanSchema.safeParse({
      ...baseLoanPayload,
      originationFee: 50_000,
    });
    expect(result.success).toBe(true);
  });
});

describe("registerLoanPaymentSchema", () => {
  const basePaymentPayload = {
    loanId: "11111111-1111-4111-8111-111111111111",
    amount: 200_000,
    accountId: "22222222-2222-4222-8222-222222222222",
    idempotencyKey: "33333333-3333-4333-8333-333333333333",
  };

  it("acepta pago de cuota con scheduleNumber", () => {
    const result = registerLoanPaymentSchema.safeParse({
      ...basePaymentPayload,
      type: "cuota",
      scheduleNumber: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rechaza pago de cuota sin scheduleNumber", () => {
    const result = registerLoanPaymentSchema.safeParse({
      ...basePaymentPayload,
      type: "cuota",
    });
    expect(result.success).toBe(false);
  });

  it("acepta abono a capital con capitalStrategy", () => {
    const result = registerLoanPaymentSchema.safeParse({
      ...basePaymentPayload,
      type: "abono_capital",
      capitalStrategy: "reduce_term",
    });
    expect(result.success).toBe(true);
  });

  it("rechaza abono a capital sin capitalStrategy", () => {
    const result = registerLoanPaymentSchema.safeParse({
      ...basePaymentPayload,
      type: "abono_capital",
    });
    expect(result.success).toBe(false);
  });
});

describe("writeOffLoanSchema", () => {
  it("acepta motivo de al menos 10 caracteres", () => {
    const result = writeOffLoanSchema.safeParse({
      loanId: "11111111-1111-4111-8111-111111111111",
      reason: "Cliente ilocalizable tras 90 días en mora",
    });
    expect(result.success).toBe(true);
  });

  it("rechaza motivo demasiado corto", () => {
    const result = writeOffLoanSchema.safeParse({
      loanId: "11111111-1111-4111-8111-111111111111",
      reason: "No paga",
    });
    expect(result.success).toBe(false);
  });
});
