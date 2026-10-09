/**
 * Compra Wilson Rodriguez 29-09-2026 · factura/referencia = ID transacción Lulo.
 * 1 iPhone 17 256GB usado, verde, batería 94%, garantía 6 meses.
 * Costo $2.468.000 (incluye transporte y vidrio templado).
 * Crea el proveedor si no existe. Reutiliza el producto de catálogo existente;
 * batería/color/garantía van en la unidad. Pago de contado por transferencia
 * desde "Lulo Bank Mireya".
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { cashAccounts, products, providers, user } from "../src/db/schema";
import { PurchaseService } from "../src/services/purchase-service";

const PRODUCT_ID = "c8c75a2d-fed2-4d0a-9b5f-a120220d657b"; // iPhone 17 256GB
const IMEI = "350938243736870";
const UNIT_COST = 2_468_000;
const TRANSACTION_ID = "20260929901383474SRV001790719747927";
const PROVIDER_NAME = "Wilson Rodriguez";

async function main() {
  let [provider] = await db.select().from(providers).where(eq(providers.name, PROVIDER_NAME)).limit(1);
  if (!provider) {
    [provider] = await db
      .insert(providers)
      .values({ name: PROVIDER_NAME, notes: "Lulo Bank: @rodriguez258" })
      .returning();
    console.log("Proveedor creado:", provider.id);
  }

  const [account] = await db
    .select()
    .from(cashAccounts)
    .where(eq(cashAccounts.name, "Lulo Bank Mireya"))
    .limit(1);
  if (!account) throw new Error("Cuenta 'Lulo Bank Mireya' no encontrada");

  const [owner] = await db.select().from(user).where(eq(user.email, "fransteven1998@gmail.com")).limit(1);
  if (!owner) throw new Error("Usuario admin no encontrado");

  const [product] = await db.select().from(products).where(eq(products.id, PRODUCT_ID)).limit(1);
  if (!product || product.name !== "iPhone 17") throw new Error("Producto iPhone 17 256GB no encontrado");

  const purchase = await PurchaseService.createPurchase({
    idempotencyKey: randomUUID(),
    providerId: provider.id,
    purchaseDate: new Date(2026, 8, 29, 22, 8, 0), // 29-09-2026 10:08 p.m. local (comprobante)
    invoiceNumber: TRANSACTION_ID,
    notes: "Comprobante Lulo Bank: $2.409.600 enviados a @rodriguez258. Costo total incluye transporte y vidrio templado.",
    details: [
      {
        productId: product.id,
        quantity: 1,
        unitCost: UNIT_COST,
        serialNumbers: [IMEI],
        condition: "used",
        warrantyMonths: 6,
        conditionDetails: { batteryHealth: 94 },
        notes: "Color: Verde",
      },
    ],
    amountPaid: UNIT_COST,
    accountId: account.id,
    paymentMethod: "transfer",
    referenceCode: TRANSACTION_ID,
    expectedTotal: UNIT_COST,
    userId: owner.id,
  });

  console.log("Compra registrada:", JSON.stringify(purchase, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
