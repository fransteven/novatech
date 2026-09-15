import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getDashboardKPIs: vi.fn(),
  getRecentSales: vi.fn(),
  getSalesTrend: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock("@/services/dashboard-service", () => ({
  getDashboardKPIs: mocks.getDashboardKPIs,
  getRecentSales: mocks.getRecentSales,
  getSalesTrend: mocks.getSalesTrend,
}));

import { getDashboardOverviewAction } from "../dashboard-actions";

describe("getDashboardOverviewAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deniega una solicitud sin sesión sin consultar los servicios", async () => {
    mocks.getSession.mockResolvedValue(null);

    await expect(getDashboardOverviewAction()).resolves.toEqual({
      success: false,
      error: "No tienes acceso al resumen operativo.",
    });
    expect(mocks.getDashboardKPIs).not.toHaveBeenCalled();
    expect(mocks.getRecentSales).not.toHaveBeenCalled();
    expect(mocks.getSalesTrend).not.toHaveBeenCalled();
  });

  it("oculta la causa interna cuando falla la carga autenticada", async () => {
    mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getDashboardKPIs.mockRejectedValue(new Error("database connection failed"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(getDashboardOverviewAction()).resolves.toEqual({
      success: false,
      error: "No fue posible cargar el resumen operativo.",
    });
    consoleError.mockRestore();
  });
});
