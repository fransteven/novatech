import { db } from "@/db";
import {
  sales,
  saleDetails,
  expenses,
  expenseCategories,
  layawayPayments,
  layaways,
  products,
  customers,
} from "@/db/schema";
import { sql, and, gte, lte, eq, gt, desc } from "drizzle-orm";
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

  const interestResult = await db
    .select({
      total: sql<number>`COALESCE(SUM(CAST(${layawayPayments.interestPortion} AS DECIMAL)), 0)`,
    })
    .from(layawayPayments)
    .where(and(
      gte(layawayPayments.createdAt, from),
      lte(layawayPayments.createdAt, to),
    ));

  const totalRevenue = Number(revenueResult[0]?.totalRevenue ?? 0);
  const totalCost = Number(revenueResult[0]?.totalCost ?? 0);
  const totalSold = Number(revenueResult[0]?.totalSold ?? 0);
  const grossProfit = totalRevenue - totalCost;
  const totalExpenses = Number(expensesResult[0]?.total ?? 0);
  const interestIncome = Number(interestResult[0]?.total ?? 0);
  const netProfit = grossProfit + interestIncome - totalExpenses;

  return {
    totalRevenue,
    totalCost,
    grossProfit,
    totalExpenses,
    interestIncome,
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

  const interestRows = await db
    .select({
      month: sql<number>`EXTRACT(MONTH FROM ${layawayPayments.createdAt})`,
      totalInterest: sql<number>`COALESCE(SUM(CAST(${layawayPayments.interestPortion} AS DECIMAL)), 0)`,
    })
    .from(layawayPayments)
    .where(and(gte(layawayPayments.createdAt, from), lte(layawayPayments.createdAt, to)))
    .groupBy(sql`EXTRACT(MONTH FROM ${layawayPayments.createdAt})`);

  const expensesByMonth = new Map(
    expenseRows.map((r) => [Number(r.month), Number(r.totalExpenses)]),
  );

  const interestByMonth = new Map(
    interestRows.map((r) => [Number(r.month), Number(r.totalInterest)]),
  );

  const result: MonthlyProfit[] = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const row = revenueRows.find((r) => Number(r.month) === m);
    const revenue = Number(row?.totalRevenue ?? 0);
    const cost = Number(row?.totalCost ?? 0);
    const grossProfit = revenue - cost;
    const totalExpenses = expensesByMonth.get(m) ?? 0;
    const interestIncome = interestByMonth.get(m) ?? 0;
    return {
      month: m,
      revenue,
      cost,
      grossProfit,
      expenses: totalExpenses,
      interestIncome,
      netProfit: grossProfit + interestIncome - totalExpenses,
    };
  });

  return result;
};

/**
 * Desglose de las filas fuente detrás de un mes de getMonthlyProfits(), para
 * auditoría rápida: qué ventas, gastos e intereses componen esos totales.
 * Usa exactamente los mismos filtros (status, rango de fechas) que los
 * agregados, así que los subtotales de cada sección deben cuadrar con las
 * columnas de esa fila mensual.
 */
export const getMonthlyProfitBreakdown = async (year: number, month: number) => {
  const from = startOfMonth(new Date(year, month - 1, 1));
  const to = endOfMonth(new Date(year, month - 1, 1));

  const saleRows = await db
    .select({
      id: saleDetails.id,
      saleId: saleDetails.saleId,
      createdAt: sales.createdAt,
      productName: products.name,
      customerName: customers.name,
      price: saleDetails.price,
      unitCost: saleDetails.unitCost,
    })
    .from(saleDetails)
    .innerJoin(sales, eq(saleDetails.saleId, sales.id))
    .innerJoin(products, eq(saleDetails.productId, products.id))
    .leftJoin(customers, eq(sales.customerId, customers.id))
    .where(
      and(
        eq(sales.status, "completed"),
        gte(sales.createdAt, from),
        lte(sales.createdAt, to),
      ),
    )
    .orderBy(desc(sales.createdAt));

  const expenseRows = await db
    .select({
      id: expenses.id,
      date: expenses.date,
      categoryName: expenseCategories.name,
      description: expenses.description,
      amount: expenses.amount,
    })
    .from(expenses)
    .innerJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
    .where(and(gte(expenses.date, from), lte(expenses.date, to)))
    .orderBy(desc(expenses.date));

  const interestRows = await db
    .select({
      id: layawayPayments.id,
      createdAt: layawayPayments.createdAt,
      customerName: customers.name,
      type: layawayPayments.type,
      amount: layawayPayments.amount,
      interestPortion: layawayPayments.interestPortion,
    })
    .from(layawayPayments)
    .innerJoin(layaways, eq(layawayPayments.layawayId, layaways.id))
    .leftJoin(customers, eq(layaways.customerId, customers.id))
    .where(
      and(
        gte(layawayPayments.createdAt, from),
        lte(layawayPayments.createdAt, to),
        gt(sql`CAST(${layawayPayments.interestPortion} AS DECIMAL)`, 0),
      ),
    )
    .orderBy(desc(layawayPayments.createdAt));

  return {
    sales: saleRows.map((r) => {
      const price = Number(r.price);
      const unitCost = Number(r.unitCost);
      return {
        id: r.id,
        saleId: r.saleId,
        createdAt: r.createdAt,
        productName: r.productName,
        customerName: r.customerName,
        price,
        unitCost,
        profit: price - unitCost,
      };
    }),
    expenses: expenseRows.map((r) => ({
      id: r.id,
      date: r.date,
      categoryName: r.categoryName,
      description: r.description,
      amount: Number(r.amount),
    })),
    interestPayments: interestRows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      customerName: r.customerName,
      type: r.type,
      amount: Number(r.amount),
      interestPortion: Number(r.interestPortion),
    })),
  };
};

export type MonthlyProfitBreakdown = Awaited<
  ReturnType<typeof getMonthlyProfitBreakdown>
>;

export type ProfitsKPIs = Awaited<ReturnType<typeof getProfitsKPIs>>;
export type MonthlyProfit = {
  month: number;
  revenue: number;
  cost: number;
  grossProfit: number;
  expenses: number;
  interestIncome: number;
  netProfit: number;
};
