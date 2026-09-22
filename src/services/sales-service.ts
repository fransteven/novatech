import { db } from "@/db";
import {
  sales,
  saleDetails,
  inventoryMovements,
  expenses,
  user,
  products,
  productItems,
} from "@/db/schema";
import { sql, desc, and, gte, lt, eq } from "drizzle-orm";
import { startOfMonth, endOfMonth, addMilliseconds } from "date-fns";

export const getSales = async () => {
  return await db
    .select({
      id: sales.id,
      totalAmount: sales.totalAmount,
      status: sales.status,
      date: sales.createdAt,
      userName: user.name,
    })
    .from(sales)
    .leftJoin(user, eq(sales.userId, user.id))
    .orderBy(desc(sales.createdAt));
};

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
