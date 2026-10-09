/**
 * Compra Brayan Vilaró 23-09-2026 · Factura FIC-0000002 (proveedor sin factura).
 * 1 iPhone 15 Pro 256GB usado, blanco, batería 100%, garantía 6 meses.
 * Reutiliza el producto de catálogo existente; batería/color/garantía van en la
 * unidad. Pago de contado por transferencia desde "Lulo Bank Mireya".
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { cashAccounts, products, providers, user } from "../src/db/schema";
import { PurchaseService } from "../src/services/purchase-service";
import { getNextFictitiousInvoiceNumber } from "../src/lib/fictitious-documents";

const PRODUCT_ID = "355d7d7f-cff8-4b19-9509-4c9ee7e6e03d"; // iPhone 15 Pro 256GB
const IMEI = "355262963486441";
const UNIT_COST = 2_237_500;
const INVOICE_NUMBER = "FIC-0000002";

async function main() {
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

  const [product] = await db.select().from(products).where(eq(products.id, PRODUCT_ID)).limit(1);
  if (!product || product.name !== "iPhone 15 Pro") throw new Error("Producto iPhone 15 Pro 256GB no encontrado");

  const nextInvoice = await getNextFictitiousInvoiceNumber();
  if (nextInvoice !== INVOICE_NUMBER) {
    throw new Error(
      `El consecutivo ficticio libre es ${nextInvoice}, no ${INVOICE_NUMBER}. Aborto para no romper la convención.`,
    );
  }

  const purchase = await PurchaseService.createPurchase({
    idempotencyKey: randomUUID(),
    providerId: provider.id,
    purchaseDate: new Date(2026, 8, 23, 12, 0, 0), // 23-09-2026 mediodía local
    invoiceNumber: INVOICE_NUMBER,
    notes: "Proveedor no entregó factura; reemplazar FIC-0000002 cuando llegue.",
    details: [
      {
        productId: product.id,
        quantity: 1,
        unitCost: UNIT_COST,
        serialNumbers: [IMEI],
        condition: "used",
        warrantyMonths: 6,
        conditionDetails: { batteryHealth: 100 },
        notes: "Color: Blanco",
      },
    ],
    amountPaid: UNIT_COST,
    accountId: account.id,
    paymentMethod: "transfer",
    referenceCode: INVOICE_NUMBER,
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
