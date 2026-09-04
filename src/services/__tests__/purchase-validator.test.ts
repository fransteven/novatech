import { describe, it, expect } from "vitest";

import { createPurchaseSchema } from "@/lib/validators/purchase-validator";

const uuid = (n: number) =>
  `0000000${n}-0000-4000-8000-000000000000`.slice(-36);

/**
 * El formulario de compras manda lo que entrega el DOM: los inputs
 * `type="number"` vacíos llegan como `""`. Antes eso se coercionaba a 0 y
 * reventaba validaciones como `batteryHealth.min(1)` con un error que la UI no
 * pintaba en ningún lado, dejando el botón de "Registrar compra" mudo.
 */
const basePayload = {
  idempotencyKey: uuid(1),
  providerId: uuid(2),
  details: [
    {
      productId: uuid(3),
      quantity: 1,
      unitCost: 1000,
      serialNumbers: ["IMEI1"],
      conditionDetails: null,
      notes: "",
    },
  ],
  amountPaid: 0,
  accountId: null,
  paymentMethod: "transfer",
};

describe("createPurchaseSchema", () => {
  it("acepta la salud de batería vacía como 'sin dato'", () => {
    const result = createPurchaseSchema.safeParse({
      ...basePayload,
      details: [
        {
          ...basePayload.details[0],
          conditionDetails: { batteryHealth: "" },
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.details[0].conditionDetails?.batteryHealth).toBeUndefined();
    }
  });

  it("sigue rechazando una salud de batería fuera de rango", () => {
    const result = createPurchaseSchema.safeParse({
      ...basePayload,
      details: [
        {
          ...basePayload.details[0],
          conditionDetails: { batteryHealth: 0 },
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("un monto pagado vacío es una compra a crédito, no un error", () => {
    const result = createPurchaseSchema.safeParse({
      ...basePayload,
      amountPaid: "",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.amountPaid).toBe(0);
  });

  it("un costo unitario vacío vale 0", () => {
    const result = createPurchaseSchema.safeParse({
      ...basePayload,
      details: [{ ...basePayload.details[0], unitCost: "" }],
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.details[0].unitCost).toBe(0);
  });

  it("un costo adicional vacío vale 0 y no rompe el prorrateo", () => {
    const result = createPurchaseSchema.safeParse({
      ...basePayload,
      extraCosts: [{ concept: "Flete", amount: "" }],
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.extraCosts?.[0].amount).toBe(0);
  });

  it("con abono exige la cuenta de caja de la que sale el pago", () => {
    const result = createPurchaseSchema.safeParse({
      ...basePayload,
      amountPaid: 500,
      accountId: null,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Selecciona la cuenta de caja de la que sale el pago",
      );
      expect(result.error.issues[0].path).toEqual(["accountId"]);
    }
  });

  it("una cantidad vacía se rechaza con el mensaje del campo", () => {
    const result = createPurchaseSchema.safeParse({
      ...basePayload,
      details: [{ ...basePayload.details[0], quantity: "" }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Cantidad debe ser mayor a 0");
    }
  });
});
