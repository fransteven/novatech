import { describe, it, expect, vi } from "vitest";
import type { DbExecutor } from "../inventory-service";

vi.mock("@/db", () => ({ db: {} }));

const resolveItemCostMock = vi.fn();
vi.mock("../inventory-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../inventory-service")>()),
  resolveItemCost: (...args: unknown[]) => resolveItemCostMock(...args),
}));

const { resolveLayawayItemCost } = await import("../layaway-service");

const ITEM_ID = "7769567f-9b45-422a-b3c5-86f49cf07561";
const PRODUCT_ID = "0f1b0d4a-1111-2222-3333-444455556666";
const tx = {} as DbExecutor;

describe("resolveLayawayItemCost", () => {
  it("usa el snapshot congelado al apartar, no el costo actual del inventario", async () => {
    resolveItemCostMock.mockResolvedValue(9999999);
    const cost = await resolveLayawayItemCost(
      { unitCost: "4600000.00", productItemId: ITEM_ID, productId: PRODUCT_ID },
      tx,
    );
    expect(cost).toBe(4600000);
    expect(resolveItemCostMock).not.toHaveBeenCalled();
  });

  it("respeta un snapshot de 0 en vez de tratarlo como ausente", async () => {
    resolveItemCostMock.mockResolvedValue(4600000);
    const cost = await resolveLayawayItemCost(
      { unitCost: "0.00", productItemId: ITEM_ID, productId: PRODUCT_ID },
      tx,
    );
    expect(cost).toBe(0);
    expect(resolveItemCostMock).not.toHaveBeenCalled();
  });

  it("sin snapshot (apartado previo a la columna): cae a resolveItemCost", async () => {
    resolveItemCostMock.mockResolvedValue(4600000);
    const cost = await resolveLayawayItemCost(
      { unitCost: null, productItemId: ITEM_ID, productId: PRODUCT_ID },
      tx,
    );
    expect(cost).toBe(4600000);
    expect(resolveItemCostMock).toHaveBeenCalledWith(ITEM_ID, PRODUCT_ID, tx);
  });
});
