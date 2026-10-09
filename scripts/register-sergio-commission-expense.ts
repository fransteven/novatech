/**
 * Comisión por referido · $30.000 a Sergio Rodriguez (Montacarguista).
 * Trajo el cliente de la venta del iPhone 17 256GB verde (IMEI 350938243736870)
 * del 04-10-2026. Se registra como gasto en la categoría "Comisiones" (se crea
 * si no existe), ligado al equipo, pagado por transferencia desde "Lulo Bank Mireya".
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { cashAccounts, expenseCategories, productItems, user } from "../src/db/schema";
import { createExpense, createExpenseCategory } from "../src/services/expense-service";

const IMEI = "350938243736870";
const AMOUNT = 30_000;

async function main() {
  let [category] = await db
    .select()
    .from(expenseCategories)
    .where(eq(expenseCategories.name, "Comisiones"))
    .limit(1);
  if (!category) {
    category = await createExpenseCategory({
      name: "Comisiones",
      description: "Comisiones a terceros por referir clientes o cerrar ventas",
    });
    console.log("Categoría creada:", category.id);
  }

  const [account] = await db
    .select()
    .from(cashAccounts)
    .where(eq(cashAccounts.name, "Lulo Bank Mireya"))
    .limit(1);
  if (!account) throw new Error("Cuenta 'Lulo Bank Mireya' no encontrada");

  const [owner] = await db.select().from(user).where(eq(user.email, "fransteven1998@gmail.com")).limit(1);
  if (!owner) throw new Error("Usuario admin no encontrado");

  const [item] = await db.select().from(productItems).where(eq(productItems.serialNumber, IMEI)).limit(1);
  if (!item) throw new Error(`Equipo con IMEI ${IMEI} no encontrado`);

  const expense = await createExpense({
    amount: AMOUNT,
    description: `Comisión referido venta iPhone 17 256GB verde (IMEI ${IMEI}) – Sergio Rodriguez (Montacarguista)`,
    categoryId: category.id,
    paymentMethod: "transfer",
    relatedProductItemId: item.id,
    accountId: account.id,
    userId: owner.id,
  });

  console.log("Gasto registrado:", JSON.stringify(expense, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
