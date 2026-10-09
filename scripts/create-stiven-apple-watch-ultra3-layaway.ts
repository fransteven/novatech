/**
 * scripts/create-stiven-apple-watch-ultra3-layaway.ts
 *
 * Apartado sin interés de Stiven Payan: Apple Watch Ultra 3 GPS + Cellular 49mm
 * Titanio Negro por $2.550.000, abono inicial $1.275.000 (Lulo Bank Mireya),
 * vence 07-01-2027.
 *
 * El reloj se pidió a Amazon (pedido 113-9329293-5385025, costo 2.201.000,
 * pagado hoy desde Lulo Bank Mireya) y aún no llega: entra con serial
 * provisional SN-FIC-000002, reservado para el apartado. Reemplazarlo por el
 * serial real al recibirlo (product_items y purchase_details).
 *
 * Run: npx tsx scripts/create-stiven-apple-watch-ultra3-layaway.ts
 */

import "dotenv/config";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db";
import {
  cashAccounts,
  customers,
  layawayDetails,
  layaways,
  productItems,
  products,
  purchases,
  user,
} from "../src/db/schema";
import { PurchaseService } from "../src/services/purchase-service";
import { createLayaway } from "../src/services/layaway-service";
import { toDbString } from "../src/lib/money";

const CUSTOMER_ID = "f93aabfa-1817-4c20-838e-71dc1d59e250"; // Stiven Payan
const CATEGORY_ID = "8e1152ca-4726-4f72-ab9d-7d2f5cb63e25"; // Smartwatches
const AMAZON_PROVIDER_ID = "0f9d0167-4da7-42fe-b8bd-11399ea58747";
const INVOICE = "113-9329293-5385025";
const SERIAL = "SN-FIC-000002";

const PRODUCT_NAME = "Apple Watch Ultra 3 49mm GPS + Cellular Titanio Negro";
const PRODUCT_ATTRS = { color: "Titanio Negro", tamano: "49mm", conectividad: "GPS + Cellular" };

const UNIT_COST = 2_201_000;
const SALE_PRICE = 2_550_000;
const INITIAL_DEPOSIT = 1_275_000;
const EXPIRES_AT = new Date("2027-01-07T00:00:00Z"); // 07-01-2027, misma convención que los apartados de la UI

async function findOrCreateProduct() {
  const [existing] = await db.select().from(products).where(eq(products.name, PRODUCT_NAME)).limit(1);
  if (existing) return existing;
  const suffix = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  const [created] = await db
    .insert(products)
    .values({
      categoryId: CATEGORY_ID,
      sku: `SMA-APPWAT-TITA-${suffix}`,
      name: PRODUCT_NAME,
      price: toDbString(SALE_PRICE),
      isSerialized: true,
      attributes: PRODUCT_ATTRS,
    })
    .returning();
  console.log("Producto creado:", created.id, created.sku);
  return created;
}

async function main() {
  const [customer] = await db.select().from(customers).where(eq(customers.id, CUSTOMER_ID)).limit(1);
  if (!customer) throw new Error("Cliente Stiven Payan no encontrado");

  const [lulo] = await db.select().from(cashAccounts).where(eq(cashAccounts.name, "Lulo Bank Mireya")).limit(1);
  if (!lulo) throw new Error("Cuenta Lulo Bank Mireya no encontrada");

  const product = await findOrCreateProduct();

  const dup = await db
    .select({ id: layaways.id })
    .from(layaways)
    .innerJoin(layawayDetails, eq(layawayDetails.layawayId, layaways.id))
    .where(
      and(
        eq(layaways.customerId, CUSTOMER_ID),
        eq(layaways.status, "active"),
        eq(layawayDetails.productId, product.id)
      )
    );
  if (dup.length > 0) throw new Error(`El cliente ya tiene este apartado (${dup[0].id}); abortando`);

  // --- Compra Amazon (reutiliza si ya quedó registrada en una corrida previa) ---
  const [existingPurchase] = await db.select().from(purchases).where(eq(purchases.invoiceNumber, INVOICE)).limit(1);
  if (!existingPurchase) {
    const [owner] = await db.select().from(user).where(eq(user.email, "fransteven1998@gmail.com")).limit(1);
    if (!owner) throw new Error("Usuario admin no encontrado");

    const purchase = await PurchaseService.createPurchase({
      idempotencyKey: randomUUID(),
      providerId: AMAZON_PROVIDER_ID,
      purchaseDate: new Date(),
      invoiceNumber: INVOICE,
      notes: `Pedido en tránsito para el apartado de Stiven Payan. Cambiar ${SERIAL} por el serial real al recibir.`,
      details: [
        {
          productId: product.id,
          quantity: 1,
          unitCost: UNIT_COST,
          serialNumbers: [SERIAL],
          condition: "new",
          notes: "Color: Titanio Negro · GPS + Cellular",
        },
      ],
      amountPaid: UNIT_COST,
      accountId: lulo.id,
      paymentMethod: "transfer",
      referenceCode: INVOICE,
      expectedTotal: UNIT_COST,
      userId: owner.id,
    });
    console.log("Compra registrada:", purchase.id);
  }

  const [item] = await db
    .select()
    .from(productItems)
    .where(and(eq(productItems.productId, product.id), eq(productItems.serialNumber, SERIAL)))
    .limit(1);
  if (!item) throw new Error(`Unidad ${SERIAL} no encontrada tras la compra`);
  if (item.status !== "available") throw new Error(`Unidad ${SERIAL} en estado ${item.status}; abortando`);

  // --- Apartado ---
  const layaway = await createLayaway({
    customerId: CUSTOMER_ID,
    type: "sin_interes",
    items: [
      {
        productId: product.id,
        productItemId: item.id,
        price: SALE_PRICE,
        quantity: 1,
        isSerialized: true,
      },
    ],
    totalAmount: SALE_PRICE,
    initialDeposit: INITIAL_DEPOSIT,
    expiresAt: EXPIRES_AT,
    paymentMethod: "transfer",
    accountId: lulo.id,
    referenceCode: "Abono inicial",
  });

  console.log("✅ Apartado creado:", layaway.id, "· saldo pendiente", SALE_PRICE - INITIAL_DEPOSIT);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
