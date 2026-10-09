import { db } from "@/db";
import {
  sales,
  saleDetails,
  expenses,
  user,
  products,
  productItems,
  customers,
} from "@/db/schema";
import { sql, desc, and, gte, lt, eq } from "drizzle-orm";
import { startOfMonth, endOfMonth, addMilliseconds } from "date-fns";

export const getSales = async () => {
  const rows = await db
    .select({
      id: sales.id,
      totalAmount: sales.totalAmount,
      status: sales.status,
      date: sales.createdAt,
      userName: user.name,
      customerName: customers.name,
      // Producto de mayor precio como titular de la venta; el resto se resume
      // con el conteo de líneas.
      leadProductName: sql<
        string | null
      >`(array_agg(${products.name} ORDER BY ${saleDetails.price} DESC))[1]`,
      productNames: sql<
        string | null
      >`string_agg(${products.name}, ' · ' ORDER BY ${saleDetails.price} DESC)`,
      lineCount: sql<number>`COUNT(${saleDetails.id})::int`,
      unitCount: sql<number>`COALESCE(SUM(${saleDetails.quantity}), 0)::int`,
      // unitCost es unitario: se multiplica por las unidades de la línea.
      totalCost: sql<string>`COALESCE(SUM(CAST(${saleDetails.unitCost} AS DECIMAL) * ${saleDetails.quantity}), 0)`,
    })
    .from(sales)
    .leftJoin(user, eq(sales.userId, user.id))
    .leftJoin(customers, eq(sales.customerId, customers.id))
    .leftJoin(saleDetails, eq(saleDetails.saleId, sales.id))
    .leftJoin(products, eq(saleDetails.productId, products.id))
    .groupBy(sales.id, user.name, customers.name)
    .orderBy(desc(sales.createdAt));

  return rows.map((row) => ({
    ...row,
    lineCount: Number(row.lineCount),
    unitCount: Number(row.unitCount),
  }));
};

export type SaleListItem = Awaited<ReturnType<typeof getSales>>[number];

export const getSalesKPIs = async () => {
  const now = new Date();
  const start = startOfMonth(now);
  // Límite superior exclusivo: endOfMonth da 23:59:59.999 y los timestamps
  // tienen precisión de microsegundos.
  const endExclusive = addMilliseconds(endOfMonth(now), 1);

  // 1. Total Income (Revenue) for current month
  const revenueResult = await db
    .select({
      total: sql<number>`COALESCE(SUM(CAST(${sales.totalAmount} AS DECIMAL)), 0)`,
    })
    .from(sales)
    .where(and(gte(sales.createdAt, start), lt(sales.createdAt, endExclusive)));

  // 2. Inventory Value Sold (COGS approx) for current month
  // saleDetails.unitCost es unitario: hay que multiplicarlo por las unidades.
  const cogsResult = await db
    .select({
      total: sql<number>`COALESCE(SUM(CAST(${saleDetails.unitCost} AS DECIMAL) * ${saleDetails.quantity}), 0)`,
    })
    .from(saleDetails)
    .innerJoin(sales, eq(saleDetails.saleId, sales.id))
    .where(and(gte(sales.createdAt, start), lt(sales.createdAt, endExclusive)));

  // 3. Total Expenses for current month
  const expensesResult = await db
    .select({
      total: sql<number>`COALESCE(SUM(CAST(${expenses.amount} AS DECIMAL)), 0)`,
    })
    .from(expenses)
    .where(and(gte(expenses.date, start), lt(expenses.date, endExclusive)));

  return {
    monthlyRevenue: Number(revenueResult[0].total),
    monthlyInventoryValueSold: Number(cogsResult[0].total),
    monthlyExpenses: Number(expensesResult[0].total),
  };
};

export const getSaleDetails = async (saleId: string) => {
  return await db
    .select({
      id: saleDetails.id,
      productName: products.name,
      price: saleDetails.price,
      quantity: saleDetails.quantity,
      sku: productItems.sku,
      serialNumber: productItems.serialNumber,
    })
    .from(saleDetails)
    .innerJoin(products, eq(saleDetails.productId, products.id))
    .leftJoin(productItems, eq(saleDetails.productItemId, productItems.id))
    .where(eq(saleDetails.saleId, saleId));
};
