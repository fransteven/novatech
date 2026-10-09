/**
 * Venta Daniela Frimac 07-10-2026.
 *
 *   - iPhone 17 Pro Max 256 (IMEI 353587237413181, en inventario) → $4.200.000
 *   - Adaptador Apple 20W USB-C (serial F168455B6C3BM0685)       →    $80.000
 *     No estaba en inventario: se compra primero a Masterplay ($50.000,
 *     transferencia Lulo Bank Mireya, factura ficticia FIC-).
 *
 * Pago de $4.280.000:
 *   - $2.600.000 efectivo (Efectivo Frank).
 *   - $1.680.000 en especie: iPhone 14 Pro Max 256 usado (batería 80%, sin
 *     piezas cambiadas). El sistema no modela permutas, así que la parte de
 *     pago entra como efectivo a "Efectivo Frank" y el equipo se registra como
 *     compra a Daniela (proveedora) pagada desde esa misma cuenta: neto +$2.600.000.
 *
 * Aborta si alguno de los seriales nuevos ya existe (no es re-ejecutable).
 *
 * Run: npx tsx scripts/create-daniela-iphone17promax-sale.ts
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../src/db";
import {
  cashAccounts,
  cashMovements,
  categories,
  customers,
  inventoryMovements,
  productItems,
  products,
  providers,
  sales,
  user,
} from "../src/db/schema";
import { PurchaseService } from "../src/services/purchase-service";
import { processSale } from "../src/services/pos-service";
import {
  getNextFictitiousCustomerDoc,
  getNextFictitiousInvoiceNumber,
} from "../src/lib/fictitious-documents";

const OPERATION_DATE = new Date(2026, 9, 7, 12, 0, 0); // 07-10-2026 mediodía local

const IPHONE17_ITEM_ID = "39693b2e-66ac-4b3c-81c1-51b3a824cad4";
const IPHONE17_IMEI = "353587237413181";
const IPHONE17_PRICE = 4_200_000;

const ADAPTER_NAME = "Adaptador de corriente USB-C 20W";
const ADAPTER_SERIAL = "F168455B6C3BM0685";
const ADAPTER_COST = 50_000;
const ADAPTER_PRICE = 80_000;

const IPHONE14_PRODUCT_ID = "79546c5c-20c8-4cd2-a58e-414a08e35a1a"; // iPhone 14 Pro Max 256
const IPHONE14_IMEI = "355086755996972";
const TRADE_IN_VALUE = 1_680_000;

const CASH_PAID = IPHONE17_PRICE + ADAPTER_PRICE - TRADE_IN_VALUE; // 2.600.000

const CUSTOMER_NAME = "Daniela Frimac";
const CUSTOMER_PHONE = "315 4381077";

const ensureProvider = async (name: string, phone: string | null) => {
  const [existing] = await db.select().from(providers).where(eq(providers.name, name)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(providers).values({ name, phone }).returning();
  console.log(`Proveedor creado: ${name}`);
  return created;
};

async function main() {
  // ─── Precondiciones ────────────────────────────────────────────────────
  const taken = await db
    .select({ serial: productItems.serialNumber })
    .from(productItems)
    .where(inArray(productItems.serialNumber, [ADAPTER_SERIAL, IPHONE14_IMEI]));
  if (taken.length > 0) {
    throw new Error(`Seriales ya registrados: ${taken.map((t) => t.serial).join(", ")}. Aborto.`);
  }

  const [iphone17] = await db
    .select()
    .from(productItems)
    .where(and(eq(productItems.id, IPHONE17_ITEM_ID), eq(productItems.serialNumber, IPHONE17_IMEI)))
    .limit(1);
  if (!iphone17 || iphone17.status !== "available") {
    throw new Error(`iPhone 17 Pro Max ${IPHONE17_IMEI} no está disponible`);
  }

  const [iphone14Product] = await db.select().from(products).where(eq(products.id, IPHONE14_PRODUCT_ID)).limit(1);
  if (!iphone14Product || iphone14Product.name !== "iPhone 14 Pro Max") {
    throw new Error("Producto iPhone 14 Pro Max no encontrado");
  }

  const [cashFrank] = await db.select().from(cashAccounts).where(eq(cashAccounts.name, "Efectivo Frank")).limit(1);
  if (!cashFrank) throw new Error("Cuenta 'Efectivo Frank' no encontrada");

  const [lulo] = await db.select().from(cashAccounts).where(eq(cashAccounts.name, "Lulo Bank Mireya")).limit(1);
  if (!lulo) throw new Error("Cuenta 'Lulo Bank Mireya' no encontrada");

  const [owner] = await db.select().from(user).where(eq(user.email, "fransteven1998@gmail.com")).limit(1);
  if (!owner) throw new Error("Usuario admin no encontrado");

  const [accessories] = await db.select().from(categories).where(eq(categories.name, "Accesorios")).limit(1);
  if (!accessories) throw new Error("Categoría Accesorios no encontrada");

  // ─── Maestros ──────────────────────────────────────────────────────────
  const masterplay = await ensureProvider("Masterplay", null);
  const danielaProvider = await ensureProvider(CUSTOMER_NAME, CUSTOMER_PHONE);

  let [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.name, CUSTOMER_NAME), eq(customers.phone, CUSTOMER_PHONE)))
    .limit(1);
  if (!customer) {
    const documentId = await getNextFictitiousCustomerDoc();
    [customer] = await db
      .insert(customers)
      .values({ documentId, name: CUSTOMER_NAME, phone: CUSTOMER_PHONE })
      .returning();
    console.log(`Clienta creada: ${CUSTOMER_NAME} (doc provisional ${documentId})`);
  }

  // Serializado como el Apple Pencil: cada adaptador Apple trae serial propio.
  let [adapter] = await db.select().from(products).where(eq(products.name, ADAPTER_NAME)).limit(1);
  if (!adapter) {
    [adapter] = await db
      .insert(products)
      .values({
        categoryId: accessories.id,
        name: ADAPTER_NAME,
        description: "Apple MWVV3AM/A · Modelo A2305",
        price: ADAPTER_PRICE.toString(),
        isSerialized: true,
        attributes: { tipo: "Cargador", marca: "Apple", conectividad: "USB-C", color: "Blanco" },
      })
      .returning();
    console.log(`Producto creado: ${ADAPTER_NAME}`);
  }

  // ─── 1. Compra del adaptador a Masterplay ─────────────────────────────
  const adapterInvoice = await getNextFictitiousInvoiceNumber();
  const adapterPurchase = await PurchaseService.createPurchase({
    idempotencyKey: randomUUID(),
    providerId: masterplay.id,
    purchaseDate: OPERATION_DATE,
    invoiceNumber: adapterInvoice,
    notes: `Proveedor no entregó factura; reemplazar ${adapterInvoice} cuando llegue.`,
    details: [
      {
        productId: adapter.id,
        quantity: 1,
        unitCost: ADAPTER_COST,
        serialNumbers: [ADAPTER_SERIAL],
        condition: "new",
      },
    ],
    amountPaid: ADAPTER_COST,
    accountId: lulo.id,
    paymentMethod: "transfer",
    referenceCode: adapterInvoice,
    expectedTotal: ADAPTER_COST,
    userId: owner.id,
  });
  console.log(`Compra adaptador: ${adapterPurchase.id} (${adapterInvoice})`);

  const [adapterItem] = await db
    .select()
    .from(productItems)
    .where(eq(productItems.serialNumber, ADAPTER_SERIAL))
    .limit(1);
  if (!adapterItem) throw new Error("No se creó la unidad del adaptador");

  // ─── 2. Venta ──────────────────────────────────────────────────────────
  const { saleId } = await processSale({
    items: [
      { productItemId: iphone17.id, productId: iphone17.productId, price: IPHONE17_PRICE, quantity: 1, isSerialized: true },
      { productItemId: adapterItem.id, productId: adapter.id, price: ADAPTER_PRICE, quantity: 1, isSerialized: true },
    ],
    totalAmount: IPHONE17_PRICE + ADAPTER_PRICE,
    userId: owner.id,
    customerId: customer.id,
    payments: [
      { accountId: cashFrank.id, method: "cash", amount: CASH_PAID },
      {
        accountId: cashFrank.id,
        method: "cash",
        amount: TRADE_IN_VALUE,
        notes: `Parte de pago en especie: iPhone 14 Pro Max IMEI ${IPHONE14_IMEI}`,
      },
    ],
  });
  console.log(`Venta: ${saleId}`);

  // processSale fecha todo con now(): se lleva al día real de la operación.
  await db.update(sales).set({ createdAt: OPERATION_DATE }).where(eq(sales.id, saleId));
  await db
    .update(cashMovements)
    .set({ occurredAt: OPERATION_DATE, createdAt: OPERATION_DATE })
    .where(and(eq(cashMovements.sourceType, "sale_payment"), eq(cashMovements.sourceId, saleId)));
  await db
    .update(inventoryMovements)
    .set({ createdAt: OPERATION_DATE })
    .where(eq(inventoryMovements.reason, `Sale #${saleId}`));

  // ─── 3. Compra del iPhone 14 Pro Max recibido ─────────────────────────
  const tradeInInvoice = await getNextFictitiousInvoiceNumber();
  const tradeInPurchase = await PurchaseService.createPurchase({
    idempotencyKey: randomUUID(),
    providerId: danielaProvider.id,
    purchaseDate: OPERATION_DATE,
    invoiceNumber: tradeInInvoice,
    notes: `Parte de pago de la venta #${saleId.slice(0, 8)} (iPhone 17 Pro Max). Sin factura.`,
    details: [
      {
        productId: iphone14Product.id,
        quantity: 1,
        unitCost: TRADE_IN_VALUE,
        serialNumbers: [IPHONE14_IMEI],
        condition: "used",
        warrantyMonths: 6,
        conditionDetails: { batteryHealth: 80 },
        notes: "Sin piezas cambiadas. Recibido como parte de pago (Daniela Frimac).",
      },
    ],
    amountPaid: TRADE_IN_VALUE,
    accountId: cashFrank.id,
    paymentMethod: "cash",
    referenceCode: tradeInInvoice,
    expectedTotal: TRADE_IN_VALUE,
    userId: owner.id,
  });
  console.log(`Compra iPhone 14 Pro Max: ${tradeInPurchase.id} (${tradeInInvoice})`);

  console.log("\n✅ Listo.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
