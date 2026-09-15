import { db } from "@/db";
import { customers, productItems, products, reservations, sales } from "@/db/schema";
import { eq, desc, sum, count, sql, and, gte, lt } from "drizzle-orm";
import { addDays, addMonths, format, startOfDay, startOfMonth, subDays, subMonths } from "date-fns";

export async function getDashboardKPIs() {
  const now = new Date();

  // Los límites superiores exclusivos no pierden las ventas del último día
  // y dejan fuera datos creados a futuro.
  const currentMonthStart = startOfMonth(now);
  const nextMonthStart = startOfMonth(addMonths(now, 1));

  const lastMonthStart = startOfMonth(subMonths(now, 1));

  // 1. Ventas Totales (Current vs Last Month)
  const [currentSalesData, lastSalesData, reservationsData, productsData, pendingPickupsData] = await Promise.all([
    db.select({ total: sum(sales.totalAmount) }).from(sales).where(and(eq(sales.status, "completed"), gte(sales.createdAt, currentMonthStart), lt(sales.createdAt, nextMonthStart))),
    db.select({ total: sum(sales.totalAmount) }).from(sales).where(and(eq(sales.status, "completed"), gte(sales.createdAt, lastMonthStart), lt(sales.createdAt, currentMonthStart))),
    db.select({ count: count() }).from(reservations).where(eq(reservations.status, "active")),
    db.select({ count: count() }).from(products),
    db.select({ count: count() }).from(productItems).where(eq(productItems.status, "reserved")),
  ]);

  const totalSalesCurrent = Number(currentSalesData[0]?.total || 0);
  const totalSalesLast = Number(lastSalesData[0]?.total || 0);

  let salesGrowth = 0;
  if (totalSalesLast > 0) {
    salesGrowth = ((totalSalesCurrent - totalSalesLast) / totalSalesLast) * 100;
  } else if (totalSalesCurrent > 0) {
    salesGrowth = 100;
  }

  const currentReservations = Number(reservationsData[0]?.count || 0);
  const totalProducts = Number(productsData[0]?.count || 0);
  const pendingPickups = Number(pendingPickupsData[0]?.count || 0);

  return {
    sales: {
      total: totalSalesCurrent,
      growth: parseFloat(salesGrowth.toFixed(1)),
    },
    reservations: {
      active: currentReservations,
    },
    products: {
      total: totalProducts,
    },
    pickups: {
      pending: pendingPickups,
    },
  };
}

export interface DashboardSalesTrendPoint {
  date: string;
  total: number;
}

export async function getSalesTrend(days = 30): Promise<DashboardSalesTrendPoint[]> {
  const startDate = startOfDay(subDays(new Date(), days - 1));
  const endDate = addDays(startDate, days);
  const day = sql<string>`to_char(date_trunc('day', ${sales.createdAt}), 'YYYY-MM-DD')`;
  const rows = await db
    .select({ day, total: sql<string>`coalesce(sum(${sales.totalAmount}), 0)` })
    .from(sales)
    .where(and(eq(sales.status, "completed"), gte(sales.createdAt, startDate), lt(sales.createdAt, endDate)))
    .groupBy(day)
    .orderBy(day);
  const totalByDay = new Map(rows.map((row) => [row.day, Number(row.total)]));

  return Array.from({ length: days }, (_, index) => {
    const date = addDays(startDate, index);
    const key = format(date, "yyyy-MM-dd");
    return { date: key, total: totalByDay.get(key) ?? 0 };
  });
}

export interface DashboardRecentSale {
  id: string;
  totalAmount: number;
  createdAt: Date;
  customerName: string;
  customerEmail: string;
}

export async function getRecentSales(limit = 5): Promise<DashboardRecentSale[]> {
  const recentSales = await db
    .select({
      id: sales.id,
      totalAmount: sales.totalAmount,
      createdAt: sales.createdAt,
      customerName: customers.name,
      customerEmail: customers.email,
    })
    .from(sales)
    .leftJoin(customers, eq(sales.customerId, customers.id))
    .where(eq(sales.status, "completed"))
    .orderBy(desc(sales.createdAt))
    .limit(limit);

  return recentSales.map((sale) => ({
    id: sale.id,
    totalAmount: Number(sale.totalAmount),
    createdAt: sale.createdAt,
    customerName: sale.customerName ?? "Cliente genérico",
    customerEmail: sale.customerEmail ?? "Venta en tienda",
  }));
}
