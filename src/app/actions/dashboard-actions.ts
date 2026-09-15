"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getDashboardKPIs, getRecentSales, getSalesTrend } from "@/services/dashboard-service";

export const getDashboardOverviewAction = async () => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return {
        success: false as const,
        error: "No tienes acceso al resumen operativo.",
      };
    }

    const [kpis, recentSales, trend] = await Promise.all([
      getDashboardKPIs(),
      getRecentSales(5),
      getSalesTrend(30),
    ]);
    return { success: true as const, data: { kpis, recentSales, trend } };
  } catch (error) {
    console.error("No fue posible cargar el dashboard", error);
    return { success: false as const, error: "No fue posible cargar el resumen operativo." };
  }
};
