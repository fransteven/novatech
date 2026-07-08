import "dotenv/config";
import { db } from "../src/db";
import { expenses, expenseCategories } from "../src/db/schema";
import { eq } from "drizzle-orm";
import {
  createExpense,
  createExpenseCategory,
} from "../src/services/expense-service";

const CATEGORY_NAME = "Gastos financieros";
const DESCRIPTION = "Cuota crédito Davivienda";
const AMOUNT = 400000;
const DATE = new Date("2026-06-30T12:00:00");
const ACCOUNT_ID = "21f77703-1c72-4322-8e45-3a07519f431a"; // Lulo Bank Mireya
const USER_ID = "G6seTMECkUEK2A8luc3nON5o6iuEYBVi"; // fransteven1998@gmail.com

async function main() {
  // 1. Resolve or create category
  let category = (
    await db
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.name, CATEGORY_NAME))
  )[0];

  if (!category) {
    category = await createExpenseCategory({
      name: CATEGORY_NAME,
      description: "Cuotas de créditos y gastos bancarios",
    });
    console.log(`Categoría creada: ${category.name} (${category.id})`);
  } else {
    console.log(`Categoría existente: ${category.name} (${category.id})`);
  }

  // 2. Avoid duplicate for the same month
  const existing = await db
    .select()
    .from(expenses)
    .where(eq(expenses.description, DESCRIPTION));

  const alreadyRegistered = existing.some((e) => {
    const d = new Date(e.date);
    return (
      d.getUTCFullYear() === DATE.getUTCFullYear() &&
      d.getUTCMonth() === DATE.getUTCMonth() &&
      Number(e.amount) === AMOUNT
    );
  });

  if (alreadyRegistered) {
    console.log("El gasto de junio ya está registrado. Abortando.");
    process.exit(0);
  }

  // 3. Create the expense (+ cash movement out of Lulo Bank Mireya)
  const expense = await createExpense({
    amount: AMOUNT,
    description: DESCRIPTION,
    categoryId: category.id,
    paymentMethod: "transfer",
    date: DATE,
    accountId: ACCOUNT_ID,
    userId: USER_ID,
  });

  console.log("Gasto registrado:", expense);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
