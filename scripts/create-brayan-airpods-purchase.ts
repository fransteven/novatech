/**
 * Compra Brayan Vilaró 24-09-2026 · Factura M14134419.
 * 5 AirPods Pro 3 réplica AAA (modelo A3065/A3122). Las 5 cajas traen el mismo
 * serial (LTOJFPRXQH), así que el producto va NO serializado. Costo unitario
 * $53.900 = ($251.000 mercancía + $18.500) / 5. Pago de contado por
 * transferencia desde "Lulo Bank Mireya" vía PurchaseService.createPurchase.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "../src/db";
import { categories, products, cashAccounts, providers, purchases, user } from "../src/db/schema";
import { PurchaseService } from "../src/services/purchase-service";
import { generateBaseSKU } from "../src/lib/utils";

const INVOICE_NUMBER = "M14134419";
const PRODUCT_NAME = "AirPods Pro 3 (Réplica AAA)";
const QUANTITY = 5;
const UNIT_COST = 53_900;
const TOTAL = 251_000 + 18_500;

async function main() {
  if (UNIT_COST * QUANTITY !== TOTAL) throw new Error("Costo unitario no cuadra con el total");

  // --- Referencias existentes ---
  const [provider] = await db
    .select()
    .from(providers)
    .where(eq(providers.name, "Brayan Vilaró Sanchez"))
    .limit(1);
  if (!provider) throw new Error("Proveedor Brayan Vilaró Sanchez no encontrado");

  const [account] = await db
    .select()
    .from(cashAccounts)
    .where(eq(cashAccounts.name, "Lulo Bank Mireya"))
    .limit(1);
  if (!account) throw new Error("Cuenta 'Lulo Bank Mireya' no encontrada");

  const [owner] = await db.select().from(user).where(eq(user.email, "fransteven1998@gmail.com")).limit(1);
  if (!owner) throw new Error("Usuario admin no encontrado");

  const [category] = await db.select().from(categories).where(eq(categories.name, "Audífonos")).limit(1);
  if (!category) throw new Error("Categoría 'Audífonos' no encontrada");

  const [dup] = await db
    .select({ id: purchases.id })
    .from(purchases)
    .where(eq(purchases.invoiceNumber, INVOICE_NUMBER))
    .limit(1);
  if (dup) throw new Error(`La factura ${INVOICE_NUMBER} ya está registrada → ${dup.id}`);

  // --- Producto (no serializado) ---
  const attributes = {
    tipo: "In-ear (TWS)",
    conectividad: "Bluetooth",
    cancelacion_ruido: "Sí (ANC)",
    color: "Blanco",
  };
  let [product] = await db
    .select()
    .from(products)
    .where(sql`TRIM(LOWER(${products.name})) = TRIM(LOWER(${PRODUCT_NAME}))`)
    .limit(1);

  if (product) {
    console.log(`Producto "${PRODUCT_NAME}" ya existía → ${product.id}`);
  } else {
    const suffix = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
    const sku = `${generateBaseSKU(category.name, PRODUCT_NAME, attributes)}-${suffix}`;
    [product] = await db
      .insert(products)
      .values({
        name: PRODUCT_NAME,
        description: "Réplica AAA de AirPods Pro 3 (modelo A3065/A3122). No original Apple.",
        sku,
        categoryId: category.id,
        price: "90000",
        isSerialized: false,
        attributes,
      })
      .returning();
    console.log(`Producto "${PRODUCT_NAME}" creado → ${product.id} (SKU ${product.sku})`);
  }

  // --- Compra ---
  const purchase = await PurchaseService.createPurchase({
    idempotencyKey: randomUUID(),
    providerId: provider.id,
    purchaseDate: new Date(2026, 8, 24, 12, 0, 0), // 24-09-2026 mediodía local
    invoiceNumber: INVOICE_NUMBER,
    notes: "Total $251.000 + $18.500 prorrateado en el costo unitario. Serial de caja repetido en las 5 unidades: LTOJFPRXQH.",
    details: [
      {
        productId: product.id,
        quantity: QUANTITY,
        unitCost: UNIT_COST,
        condition: "new",
      },
    ],
    amountPaid: TOTAL,
    accountId: account.id,
    paymentMethod: "transfer",
    referenceCode: INVOICE_NUMBER,
    expectedTotal: TOTAL,
    userId: owner.id,
  });

  console.log("\nCompra registrada:", JSON.stringify(purchase, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
