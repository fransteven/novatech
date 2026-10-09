/**
 * Compra Cellsite 30-09-2026 · sin factura (consecutivo ficticio FIC-).
 * 1 Apple Pencil (USB-C) nuevo, serial D667FC370L, costo $330.000.
 * Reutiliza el producto de catálogo existente. Pago de contado por
 * transferencia desde "Lulo Bank Mireya".
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { cashAccounts, products, providers, user } from "../src/db/schema";
import { PurchaseService } from "../src/services/purchase-service";
import { getNextFictitiousInvoiceNumber } from "../src/lib/fictitious-documents";

const PRODUCT_ID = "1fb1c90f-8836-401d-8fec-9bf1a2d8838e"; // Apple Pencil (USB-C)
const SERIAL = "D667FC370L";
const UNIT_COST = 330_000;

async function main() {
  const [provider] = await db.select().from(providers).where(eq(providers.name, "Cellsite")).limit(1);
  if (!provider) throw new Error("Proveedor Cellsite no encontrado");

  const [account] = await db
    .select()
    .from(cashAccounts)
    .where(eq(cashAccounts.name, "Lulo Bank Mireya"))
    .limit(1);
  if (!account) throw new Error("Cuenta 'Lulo Bank Mireya' no encontrada");

  const [owner] = await db.select().from(user).where(eq(user.email, "fransteven1998@gmail.com")).limit(1);
  if (!owner) throw new Error("Usuario admin no encontrado");

  const [product] = await db.select().from(products).where(eq(products.id, PRODUCT_ID)).limit(1);
  if (!product || product.name !== "Apple Pencil (USB-C)") throw new Error("Producto Apple Pencil (USB-C) no encontrado");

  const invoiceNumber = await getNextFictitiousInvoiceNumber();

  const purchase = await PurchaseService.createPurchase({
    idempotencyKey: randomUUID(),
    providerId: provider.id,
    purchaseDate: new Date(2026, 8, 30, 12, 0, 0), // 30-09-2026 mediodía local
    invoiceNumber,
    notes: `Proveedor no entregó factura; reemplazar ${invoiceNumber} cuando llegue.`,
    details: [
      {
        productId: product.id,
        quantity: 1,
        unitCost: UNIT_COST,
        serialNumbers: [SERIAL],
        condition: "new",
      },
    ],
    amountPaid: UNIT_COST,
    accountId: account.id,
    paymentMethod: "transfer",
    referenceCode: invoiceNumber,
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
