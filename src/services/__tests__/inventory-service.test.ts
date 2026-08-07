import { describe, it, expect } from "vitest";
import { resolveItemCost, type DbExecutor } from "../inventory-service";

type Row = Record<string, unknown>;

/**
 * Ejecutor falso: devuelve, en orden, cada lote de filas de `results`
 * por cada consulta que resolveItemCost dispare. Soporta tanto
 * `.where(...).limit(n)` como `await ...where(...)` (camino del WAC).
 */
const makeExecutor = (results: Row[][]): DbExecutor => {
  const queue = [...results];
  const executor = {
    select: () => ({
      from: () => ({
        where: () => {
          const rows = queue.shift() ?? [];
          return {
            limit: () => Promise.resolve(rows),
            then: (onFulfilled: (value: Row[]) => unknown) =>
              Promise.resolve(rows).then(onFulfilled),
          };
        },
      }),
    }),
  };
  return executor as unknown as DbExecutor;
};

const ITEM_ID = "7769567f-9b45-422a-b3c5-86f49cf07561";
const PRODUCT_ID = "0f1b0d4a-1111-2222-3333-444455556666";

describe("resolveItemCost", () => {
  it("serializado: toma el costo del movimiento IN", async () => {
    const tx = makeExecutor([[{ unitCost: "2600000.00" }]]);
    expect(await resolveItemCost(ITEM_ID, PRODUCT_ID, tx)).toBe(2600000);
  });

  it("serializado sin movimiento IN: cae a product_items.unit_cost", async () => {
    const tx = makeExecutor([[], [{ unitCost: "2600000.00" }]]);
    expect(await resolveItemCost(ITEM_ID, PRODUCT_ID, tx)).toBe(2600000);
  });

  it("serializado sin costo en ningún lado: 0", async () => {
    const tx = makeExecutor([[], []]);
    expect(await resolveItemCost(ITEM_ID, PRODUCT_ID, tx)).toBe(0);
  });

  it("no serializado: usa el WAC del producto", async () => {
    const tx = makeExecutor([[{ totalQuantity: 4, totalValue: 4000000 }]]);
    expect(await resolveItemCost(null, PRODUCT_ID, tx)).toBe(1000000);
  });

  it("no serializado sin historial de compras: 0", async () => {
    const tx = makeExecutor([[{ totalQuantity: 0, totalValue: 0 }]]);
    expect(await resolveItemCost(null, PRODUCT_ID, tx)).toBe(0);
  });

  it("nunca devuelve 0 cuando el ítem sí tiene costo (regresión: unitCost '0' en créditos)", async () => {
    const tx = makeExecutor([[{ unitCost: "2600000.00" }]]);
    const cost = await resolveItemCost(ITEM_ID, PRODUCT_ID, tx);
    expect(cost).toBeGreaterThan(0);
  });
});
