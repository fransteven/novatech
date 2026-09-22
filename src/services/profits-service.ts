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
  loans,
  loanPayments,
} from "@/db/schema";
import { sql, and, gte, lt, ne, or, isNull, eq, desc } from "drizzle-orm";
import {
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  addMilliseconds,
} from "date-fns";

type DateRange = { from: Date; to: Date };

export function getDefaultDateRange(): DateRange {
  const now = new Date();
  return { from: startOfMonth(now), to: endOfMonth(now) };
}

/**
 * `to` llega como fin de período inclusivo (23:59:59.999), pero las columnas
 * son timestamps con precisión de microsegundos: una fila en .9995 caía fuera
 * del `lte`. Todos los filtros usan `>= from AND < toExclusive`.
 */
const toExclusiveBound = (to: Date) => addMilliseconds(to, 1);

/** Ingreso y costo de una línea: `price`/`unit_cost` son unitarios. */
const lineRevenueSql = sql`CAST(${saleDetails.price} AS DECIMAL) * ${saleDetails.quantity}`;
const lineCostSql = sql`CAST(${saleDetails.unitCost} AS DECIMAL) * ${saleDetails.quantity}`;

/**
 * Capital insoluto de préstamos al cierre del período, no "a hoy".
 *
 * Antes la tarjeta sumaba `loans.outstanding_principal` de los préstamos activos
 * ignorando el rango de fechas, así que un reporte de un mes cerrado mostraba la
 * cartera del día de consulta. Aquí se reconstruye a la fecha de corte:
 * capital desembolsado menos el capital abonado hasta ese momento.
 *
 * `asOfExclusive` es el límite superior exclusivo del período.
 */
const getLoanPortfolioAsOf = async (asOfExclusive: Date): Promise<number> => {
  const loanRows = await db
    .select({
      id: loans.id,
      principal: loans.principalAmount,
    })
    .from(loans)
    .where(
      and(
        lt(loans.disbursedAt, asOfExclusive),
        ne(loans.status, "cancelled"),
        // Un préstamo castigado deja de ser cartera desde que se castiga, pero
        // seguía siéndolo en los períodos anteriores al castigo.
        or(
          isNull(loans.writtenOffAt),
          gte(loans.writtenOffAt, asOfExclusive),
        ),
      ),
    );

  if (loanRows.length === 0) return 0;

  const paidRows = await db
    .select({
      loanId: loanPayments.loanId,
      principalPaid: sql<number>`COALESCE(SUM(CAST(${loanPayments.principalPortion} AS DECIMAL)), 0)`,
    })
    .from(loanPayments)
    .where(lt(loanPayments.createdAt, asOfExclusive))
    .groupBy(loanPayments.loanId);

  const paidByLoan = new Map(
    paidRows.map((r) => [r.loanId, Number(r.principalPaid)]),
  );

  return loanRows.reduce((acc, loan) => {
    const outstanding = Number(loan.principal) - (paidByLoan.get(loan.id) ?? 0);
    return acc + Math.max(outstanding, 0);
  }, 0);
};

export const getProfitsKPIs = async (range?: DateRange) => {
  const { from, to } = range ?? getDefaultDateRange();
  const toExclusive = toExclusiveBound(to);

  const revenueResult = await db
    .select({
      totalRevenue: sql<number>`COALESCE(SUM(${lineRevenueSql}), 0)`,
      totalCost: sql<number>`COALESCE(SUM(${lineCostSql}), 0)`,
      totalSold: sql<number>`COALESCE(SUM(${saleDetails.quantity}), 0)`,
    })
    .from(saleDetails)
    .innerJoin(sales, eq(saleDetails.saleId, sales.id))
    .where(
      and(
        eq(sales.status, "completed"),
        gte(sales.createdAt, from),
        lt(sales.createdAt, toExclusive),
      ),
    );

  const expensesResult = await db
    .select({
      total: sql<number>`COALESCE(SUM(CAST(${expenses.amount} AS DECIMAL)), 0)`,
    })
    .from(expenses)
    .where(and(gte(expenses.date, from), lt(expenses.date, toExclusive)));

  const interestResult = await db
    .select({
      total: sql<number>`COALESCE(SUM(CAST(${layawayPayments.interestPortion} AS DECIMAL)), 0)`,
    })
    .from(layawayPayments)
    .where(and(
      gte(layawayPayments.createdAt, from),
      lt(layawayPayments.createdAt, toExclusive),
    ));

  const loanInterestResult = await db
    .select({
      total: sql<number>`COALESCE(SUM(CAST(${loanPayments.interestPortion} AS DECIMAL)), 0)`,
    })
    .from(loanPayments)
    .where(and(
      gte(loanPayments.createdAt, from),
      lt(loanPayments.createdAt, toExclusive),
    ));

  const activeLoanPortfolio = await getLoanPortfolioAsOf(toExclusive);

  const otherIncomeResult = await db
    .select({
      total: sql<number>`COALESCE(SUM(CAST(${otherIncome.amount} AS DECIMAL)), 0)`,
    })
    .from(otherIncome)
    .where(and(gte(otherIncome.date, from), lt(otherIncome.date, toExclusive)));

  const salesRevenue = Number(revenueResult[0]?.totalRevenue ?? 0);
  const totalCost = Number(revenueResult[0]?.totalCost ?? 0);
  const totalSold = Number(revenueResult[0]?.totalSold ?? 0);
  const totalExpenses = Number(expensesResult[0]?.total ?? 0);
  const interestIncome =
    Number(interestResult[0]?.total ?? 0) +
    Number(loanInterestResult[0]?.total ?? 0);
  const otherIncomeTotal = Number(otherIncomeResult[0]?.total ?? 0);

  // El interés de créditos y préstamos es ingreso operativo, no un extra: entra al
  // ingreso total y al margen bruto. Sin costo asociado, así que suma completo a la utilidad.
  // Lo mismo aplica a comisiones de originación y retención de capital.
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
    activeLoanPortfolio,
    // Margen sobre el ingreso total (ventas + intereses)
    grossMarginPct: totalIncome > 0 ? (grossProfit / totalIncome) * 100 : 0,
    // Margen solo del producto, para comparar precios de venta contra costo
    productMarginPct:
      salesRevenue > 0 ? ((salesRevenue - totalCost) / salesRevenue) * 100 : 0,
  };
};

export const getMonthlyProfits = async (year: number) => {
  const from = startOfYear(new Date(year, 0, 1));
  const toExclusive = toExclusiveBound(endOfYear(new Date(year, 0, 1)));

  const revenueRows = await db
    .select({
      month: sql<number>`EXTRACT(MONTH FROM ${sales.createdAt})`,
      totalRevenue: sql<number>`COALESCE(SUM(${lineRevenueSql}), 0)`,
      totalCost: sql<number>`COALESCE(SUM(${lineCostSql}), 0)`,
    })
    .from(saleDetails)
    .innerJoin(sales, eq(saleDetails.saleId, sales.id))
    .where(
      and(
        eq(sales.status, "completed"),
        gte(sales.createdAt, from),
        lt(sales.createdAt, toExclusive),
      ),
    )
    .groupBy(sql`EXTRACT(MONTH FROM ${sales.createdAt})`);

  const expenseRows = await db
    .select({
      month: sql<number>`EXTRACT(MONTH FROM ${expenses.date})`,
      totalExpenses: sql<number>`COALESCE(SUM(CAST(${expenses.amount} AS DECIMAL)), 0)`,
    })
    .from(expenses)
    .where(and(gte(expenses.date, from), lt(expenses.date, toExclusive)))
    .groupBy(sql`EXTRACT(MONTH FROM ${expenses.date})`);

  const interestRows = await db
    .select({
      month: sql<number>`EXTRACT(MONTH FROM ${layawayPayments.createdAt})`,
      totalInterest: sql<number>`COALESCE(SUM(CAST(${layawayPayments.interestPortion} AS DECIMAL)), 0)`,
    })
    .from(layawayPayments)
    .where(and(gte(layawayPayments.createdAt, from), lt(layawayPayments.createdAt, toExclusive)))
    .groupBy(sql`EXTRACT(MONTH FROM ${layawayPayments.createdAt})`);

  const loanInterestRows = await db
    .select({
      month: sql<number>`EXTRACT(MONTH FROM ${loanPayments.createdAt})`,
      totalInterest: sql<number>`COALESCE(SUM(CAST(${loanPayments.interestPortion} AS DECIMAL)), 0)`,
    })
    .from(loanPayments)
    .where(and(gte(loanPayments.createdAt, from), lt(loanPayments.createdAt, toExclusive)))
    .groupBy(sql`EXTRACT(MONTH FROM ${loanPayments.createdAt})`);

  const otherIncomeRows = await db
    .select({
      month: sql<number>`EXTRACT(MONTH FROM ${otherIncome.date})`,
      total: sql<number>`COALESCE(SUM(CAST(${otherIncome.amount} AS DECIMAL)), 0)`,
    })
    .from(otherIncome)
    .where(and(gte(otherIncome.date, from), lt(otherIncome.date, toExclusive)))
    .groupBy(sql`EXTRACT(MONTH FROM ${otherIncome.date})`);

  const expensesByMonth = new Map(
    expenseRows.map((r) => [Number(r.month), Number(r.totalExpenses)]),
  );

  const interestByMonth = new Map(
    interestRows.map((r) => [Number(r.month), Number(r.totalInterest)]),
  );

  const loanInterestByMonth = new Map(
    loanInterestRows.map((r) => [Number(r.month), Number(r.totalInterest)]),
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
    const interestIncome =
      (interestByMonth.get(m) ?? 0) + (loanInterestByMonth.get(m) ?? 0);
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
  const toExclusive = toExclusiveBound(endOfMonth(new Date(year, month - 1, 1)));

  const saleRows = await db
    .select({
      id: saleDetails.id,
      saleId: saleDetails.saleId,
      createdAt: sales.createdAt,
      productName: products.name,
      customerName: customers.name,
      price: saleDetails.price,
      unitCost: saleDetails.unitCost,
      quantity: saleDetails.quantity,
    })
    .from(saleDetails)
    .innerJoin(sales, eq(saleDetails.saleId, sales.id))
    .innerJoin(products, eq(saleDetails.productId, products.id))
    .leftJoin(customers, eq(sales.customerId, customers.id))
    .where(
      and(
        eq(sales.status, "completed"),
        gte(sales.createdAt, from),
        lt(sales.createdAt, toExclusive),
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
    .where(and(gte(expenses.date, from), lt(expenses.date, toExclusive)))
    .orderBy(desc(expenses.date));

  // Sin filtrar por interés > 0: el desglose es la pista de auditoría del mes,
  // y esconder los abonos a capital hacía imposible cuadrarlo contra la caja
  // (16 pagos cobrados, 7 listados). El total de la sección sigue siendo la
  // suma de `interestPortion`, que es lo que entra a la fila mensual.
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
        lt(layawayPayments.createdAt, toExclusive),
      ),
    )
    .orderBy(desc(layawayPayments.createdAt));

  const loanInterestRows = await db
    .select({
      id: loanPayments.id,
      createdAt: loanPayments.createdAt,
      customerName: customers.name,
      type: loanPayments.type,
      amount: loanPayments.amount,
      interestPortion: loanPayments.interestPortion,
    })
    .from(loanPayments)
    .innerJoin(loans, eq(loanPayments.loanId, loans.id))
    .leftJoin(customers, eq(loans.customerId, customers.id))
    .where(
      and(
        gte(loanPayments.createdAt, from),
        lt(loanPayments.createdAt, toExclusive),
      ),
    )
    .orderBy(desc(loanPayments.createdAt));

  const combinedInterest = [
    ...interestRows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      customerName: r.customerName,
      type: r.type,
      amount: Number(r.amount),
      interestPortion: Number(r.interestPortion),
    })),
    ...loanInterestRows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      customerName: r.customerName,
      type: `prestamo_${r.type}`,
      amount: Number(r.amount),
      interestPortion: Number(r.interestPortion),
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const otherIncomeRows = await db
    .select({
      id: otherIncome.id,
      date: otherIncome.date,
      concept: otherIncome.concept,
      description: otherIncome.description,
      amount: otherIncome.amount,
    })
    .from(otherIncome)
    .where(and(gte(otherIncome.date, from), lt(otherIncome.date, toExclusive)))
    .orderBy(desc(otherIncome.date));

  return {
    sales: saleRows.map((r) => {
      const unitPrice = Number(r.price);
      const unitCost = Number(r.unitCost);
      const quantity = r.quantity;
      // `price` y `unitCost` son unitarios; lo que cuadra contra la fila
      // mensual es el valor de línea.
      return {
        id: r.id,
        saleId: r.saleId,
        createdAt: r.createdAt,
        productName: r.productName,
        customerName: r.customerName,
        quantity,
        unitPrice,
        unitCost,
        price: unitPrice * quantity,
        cost: unitCost * quantity,
        profit: (unitPrice - unitCost) * quantity,
      };
    }),
    expenses: expenseRows.map((r) => ({
      id: r.id,
      date: r.date,
      categoryName: r.categoryName,
      description: r.description,
      amount: Number(r.amount),
    })),
    interestPayments: combinedInterest,
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
