/**
 * Compra proveedor Estados Unidos (placeholder) 22-09-2026 · sin factura (FIC-).
 * 5 iPhone 17 Pro Max 256GB nuevos: 2 azules + 3 blancos.
 * Costo aterrizado exacto $3.850.000 c/u = $3.732.300 equipo + $117.700 flete.
 * Pagos (todos fechados el día de la compra):
 *   - $14.575.000 Efectivo Frank (equipos)
 *   - $4.086.500 Lulo Bank Mireya (equipos)
 *   - $588.500 Efectivo Frank (flete)
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "../src/db";
import { cashAccounts, cashMovements, products, providers, purchasePayments, purchases, user } from "../src/db/schema";
import { PurchaseService } from "../src/services/purchase-service";
import { getNextFictitiousInvoiceNumber } from "../src/lib/fictitious-documents";

const PRODUCT_ID = "70127100-5bf0-42b6-b885-f17d25e98cb0"; // iPhone 17 Pro Max 256GB (Nuevo)
const PROVIDER_NAME = "Proveedor Estados Unidos (pendiente)";
const BLUE_IMEIS = ["355599588361677", "355599588099285"];
const WHITE_IMEIS = ["353587238972599", "358015865497297", "353587237413181"];
const UNIT_COST = 3_732_300;
const FREIGHT = 588_500;
const TOTAL = 19_250_000;
const PAID_CASH_FRANK = 14_575_000;
const PAID_LULO = 4_086_500;
const PURCHASE_DATE = new Date(2026, 8, 22, 12, 0, 0); // 22-09-2026 mediodía local

async function accountByName(name: string) {
  const [account] = await db.select().from(cashAccounts).where(eq(cashAccounts.name, name)).limit(1);
  if (!account) throw new Error(`Cuenta '${name}' no encontrada`);
  return account;
}

async function main() {
  let [provider] = await db.select().from(providers).where(eq(providers.name, PROVIDER_NAME)).limit(1);
  if (!provider) {
    [provider] = await db
      .insert(providers)
      .values({
        name: PROVIDER_NAME,
        country: "Estados Unidos",
        notes: "Placeholder: completar nombre y datos de contacto reales.",
      })
      .returning();
    console.log("Proveedor creado:", provider.id);
  }

  const cashFrank = await accountByName("Efectivo Frank");
  const lulo = await accountByName("Lulo Bank Mireya");

  const [owner] = await db.select().from(user).where(eq(user.email, "fransteven1998@gmail.com")).limit(1);
  if (!owner) throw new Error("Usuario admin no encontrado");

  const [product] = await db.select().from(products).where(eq(products.id, PRODUCT_ID)).limit(1);
  if (!product || product.name !== "iPhone 17 Pro Max") throw new Error("Producto iPhone 17 Pro Max 256GB no encontrado");

  const invoiceNumber = await getNextFictitiousInvoiceNumber();
  const idempotencyKey = randomUUID();

  const purchase = await PurchaseService.createPurchase({
    idempotencyKey,
    providerId: provider.id,
    purchaseDate: PURCHASE_DATE,
    invoiceNumber,
    notes: `Proveedor no entregó factura; reemplazar ${invoiceNumber} cuando llegue. Flete prorrateado para costo exacto de $3.850.000 por equipo.`,
    details: [
      {
        productId: product.id,
        quantity: BLUE_IMEIS.length,
        unitCost: UNIT_COST,
        serialNumbers: BLUE_IMEIS,
        condition: "new",
        notes: "Color: Azul",
      },
      {
        productId: product.id,
        quantity: WHITE_IMEIS.length,
        unitCost: UNIT_COST,
        serialNumbers: WHITE_IMEIS,
        condition: "new",
        notes: "Color: Blanco",
      },
    ],
    extraCosts: [{ concept: "Flete", amount: FREIGHT }],
    amountPaid: PAID_CASH_FRANK,
    accountId: cashFrank.id,
    paymentMethod: "cash",
    referenceCode: invoiceNumber,
    expectedTotal: TOTAL,
    userId: owner.id,
  });

  const luloPayment = await PurchaseService.registerPurchasePayment({
    purchaseId: purchase.id,
    amount: PAID_LULO,
    accountId: lulo.id,
    paymentMethod: "transfer",
    referenceCode: invoiceNumber,
    notes: `Pago de compra #${purchase.id.slice(0, 8)} (equipos)`,
    idempotencyKey: `${idempotencyKey}:lulo`,
    userId: owner.id,
  });

  const freightPayment = await PurchaseService.registerPurchasePayment({
    purchaseId: purchase.id,
    amount: FREIGHT,
    accountId: cashFrank.id,
    paymentMethod: "cash",
    referenceCode: invoiceNumber,
    notes: `Pago de flete compra #${purchase.id.slice(0, 8)}`,
    idempotencyKey: `${idempotencyKey}:flete`,
    userId: owner.id,
  });

  // registerPurchasePayment fecha los abonos "ahora"; se llevan a la fecha real de la compra.
  const payments = await db
    .select({ id: purchasePayments.id, cashMovementId: purchasePayments.cashMovementId })
    .from(purchasePayments)
    .where(eq(purchasePayments.purchaseId, purchase.id));
  await db
    .update(purchasePayments)
    .set({ occurredAt: PURCHASE_DATE })
    .where(eq(purchasePayments.purchaseId, purchase.id));
  await db
    .update(cashMovements)
    .set({ occurredAt: PURCHASE_DATE })
    .where(inArray(cashMovements.id, payments.map((p) => p.cashMovementId).filter((id): id is string => !!id)));

  const [final] = await db.select().from(purchases).where(eq(purchases.id, purchase.id));
  console.log("Compra registrada:", JSON.stringify(final, null, 2));
  console.log("Abonos:", luloPayment, freightPayment);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
