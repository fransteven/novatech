import { db } from "@/db";
import { sales, saleDetails, expenses } from "@/db/schema";
import { sql, and, gte, lte, eq } from "drizzle-orm";
import { startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";

type DateRange = { from: Date; to: Date };

export function getDefaultDateRange(): DateRange {
  const now = new Date();
  return { from: startOfMonth(now), to: endOfMonth(now) };
}

export const getProfitsKPIs = async (range?: DateRange) => {
  const { from, to } = range ?? getDefaultDateRange();

  const revenueResult = await db
    .select({
      totalRevenue: sql<number>`COALESCE(SUM(CAST(${saleDetails.price} AS DECIMAL)), 0)`,
      totalCost: sql<number>`COALESCE(SUM(CAST(${saleDetails.unitCost} AS DECIMAL)), 0)`,
      totalSold: sql<number>`COUNT(${saleDetails.id})`,
    })
    .from(saleDetails)
    .innerJoin(sales, eq(saleDetails.saleId, sales.id))
    .where(
      and(
        eq(sales.status, "completed"),
        gte(sales.createdAt, from),
        lte(sales.createdAt, to),
      ),
    );

  const expensesResult = await db
    .select({
      total: sql<number>`COALESCE(SUM(CAST(${expenses.amount} AS DECIMAL)), 0)`,
    })
    .from(expenses)
    .where(and(gte(expenses.date, from), lte(expenses.date, to)));

  const totalRevenue = Number(revenueResult[0]?.totalRevenue ?? 0);
  const totalCost = Number(revenueResult[0]?.totalCost ?? 0);
  const totalSold = Number(revenueResult[0]?.totalSold ?? 0);
  const grossProfit = totalRevenue - totalCost;
  const totalExpenses = Number(expensesResult[0]?.total ?? 0);
  const netProfit = grossProfit - totalExpenses;

  return {
    totalRevenue,
    totalCost,
    grossProfit,
    totalExpenses,
    netProfit,
    totalSold,
    grossMarginPct: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
  };
};

export const getMonthlyProfits = async (year: number) => {
  const from = startOfYear(new Date(year, 0, 1));
  const to = endOfYear(new Date(year, 0, 1));

  const revenueRows = await db
    .select({
      month: sql<number>`EXTRACT(MONTH FROM ${sales.createdAt})`,
      totalRevenue: sql<number>`COALESCE(SUM(CAST(${saleDetails.price} AS DECIMAL)), 0)`,
      totalCost: sql<number>`COALESCE(SUM(CAST(${saleDetails.unitCost} AS DECIMAL)), 0)`,
    })
    .from(saleDetails)
    .innerJoin(sales, eq(saleDetails.saleId, sales.id))
    .where(
      and(
        eq(sales.status, "completed"),
        gte(sales.createdAt, from),
        lte(sales.createdAt, to),
      ),
    )
    .groupBy(sql`EXTRACT(MONTH FROM ${sales.createdAt})`);

  const expenseRows = await db
    .select({
      month: sql<number>`EXTRACT(MONTH FROM ${expenses.date})`,
      totalExpenses: sql<number>`COALESCE(SUM(CAST(${expenses.amount} AS DECIMAL)), 0)`,
    })
    .from(expenses)
    .where(and(gte(expenses.date, from), lte(expenses.date, to)))
    .groupBy(sql`EXTRACT(MONTH FROM ${expenses.date})`);

  const expensesByMonth = new Map(
    expenseRows.map((r) => [Number(r.month), Number(r.totalExpenses)]),
  );

  const result: MonthlyProfit[] = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const row = revenueRows.find((r) => Number(r.month) === m);
    const revenue = Number(row?.totalRevenue ?? 0);
    const cost = Number(row?.totalCost ?? 0);
    const grossProfit = revenue - cost;
    const totalExpenses = expensesByMonth.get(m) ?? 0;
    return {
      month: m,
      revenue,
      cost,
      grossProfit,
      expenses: totalExpenses,
      netProfit: grossProfit - totalExpenses,
    };
  });

  return result;
};

export type ProfitsKPIs = Awaited<ReturnType<typeof getProfitsKPIs>>;
export type MonthlyProfit = {
  month: number;
  revenue: number;
  cost: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
};
