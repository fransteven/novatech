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
  otherIncome,
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

  const otherIncomeResult = await db
    .select({
      total: sql<number>`COALESCE(SUM(CAST(${otherIncome.amount} AS DECIMAL)), 0)`,
    })
    .from(otherIncome)
    .where(and(gte(otherIncome.date, from), lte(otherIncome.date, to)));

  const salesRevenue = Number(revenueResult[0]?.totalRevenue ?? 0);
  const totalCost = Number(revenueResult[0]?.totalCost ?? 0);
  const totalSold = Number(revenueResult[0]?.totalSold ?? 0);
  const totalExpenses = Number(expensesResult[0]?.total ?? 0);
  const interestIncome = Number(interestResult[0]?.total ?? 0);
  const otherIncomeTotal = Number(otherIncomeResult[0]?.total ?? 0);

  // El interés de los créditos es ingreso operativo, no un extra: entra al
  // ingreso total y al margen bruto. Sin costo asociado (el costo del equipo ya
  // se reconoce con la venta), así que suma completo a la utilidad. Lo mismo
  // aplica a la retención de capital de créditos cancelados.
  const totalIncome = salesRevenue + interestIncome + otherIncomeTotal;
  const grossProfit = totalIncome - totalCost;
  const netProfit = grossProfit - totalExpenses;

  return {
    salesRevenue,
    interestIncome,
    otherIncome: otherIncomeTotal,
    totalIncome,
    totalCost,
    grossProfit,
    totalExpenses,
    netProfit,
    totalSold,
    // Margen sobre el ingreso total (ventas + intereses)
    grossMarginPct: totalIncome > 0 ? (grossProfit / totalIncome) * 100 : 0,
    // Margen solo del producto, para comparar precios de venta contra costo
    productMarginPct:
      salesRevenue > 0 ? ((salesRevenue - totalCost) / salesRevenue) * 100 : 0,
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

  const otherIncomeRows = await db
    .select({
      month: sql<number>`EXTRACT(MONTH FROM ${otherIncome.date})`,
      total: sql<number>`COALESCE(SUM(CAST(${otherIncome.amount} AS DECIMAL)), 0)`,
    })
    .from(otherIncome)
    .where(and(gte(otherIncome.date, from), lte(otherIncome.date, to)))
    .groupBy(sql`EXTRACT(MONTH FROM ${otherIncome.date})`);

  const expensesByMonth = new Map(
    expenseRows.map((r) => [Number(r.month), Number(r.totalExpenses)]),
  );

  const interestByMonth = new Map(
    interestRows.map((r) => [Number(r.month), Number(r.totalInterest)]),
  );

  const otherIncomeByMonth = new Map(
    otherIncomeRows.map((r) => [Number(r.month), Number(r.total)]),
  );

  const result: MonthlyProfit[] = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const row = revenueRows.find((r) => Number(r.month) === m);
    const salesRevenue = Number(row?.totalRevenue ?? 0);
    const cost = Number(row?.totalCost ?? 0);
    const totalExpenses = expensesByMonth.get(m) ?? 0;
    const interestIncome = interestByMonth.get(m) ?? 0;
    const otherIncomeTotal = otherIncomeByMonth.get(m) ?? 0;
    // Mismo criterio que getProfitsKPIs: el interés es ingreso del mes en que
    // se cobró, y el margen del equipo cae en el mes en que se liquida el crédito.
    const totalIncome = salesRevenue + interestIncome + otherIncomeTotal;
    const grossProfit = totalIncome - cost;
    return {
      month: m,
      salesRevenue,
      interestIncome,
      otherIncome: otherIncomeTotal,
      totalIncome,
      cost,
      grossProfit,
      expenses: totalExpenses,
      netProfit: grossProfit - totalExpenses,
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

  const otherIncomeRows = await db
    .select({
      id: otherIncome.id,
      date: otherIncome.date,
      concept: otherIncome.concept,
      description: otherIncome.description,
      amount: otherIncome.amount,
    })
    .from(otherIncome)
    .where(and(gte(otherIncome.date, from), lte(otherIncome.date, to)))
    .orderBy(desc(otherIncome.date));

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
    otherIncome: otherIncomeRows.map((r) => ({
      id: r.id,
      date: r.date,
      concept: r.concept,
      description: r.description,
      amount: Number(r.amount),
    })),
  };
};

export type MonthlyProfitBreakdown = Awaited<
  ReturnType<typeof getMonthlyProfitBreakdown>
>;

export type ProfitsKPIs = Awaited<ReturnType<typeof getProfitsKPIs>>;
export type MonthlyProfit = {
  month: number;
  /** Ingreso por venta de producto (precio pactado, sin intereses) */
  salesRevenue: number;
  /** Intereses de crédito cobrados en el mes */
  interestIncome: number;
  /** Ingresos sin producto: retención de capital de créditos cancelados */
  otherIncome: number;
  /** salesRevenue + interestIncome + otherIncome */
  totalIncome: number;
  cost: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
};
