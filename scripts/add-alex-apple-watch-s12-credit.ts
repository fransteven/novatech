/**
 * scripts/add-alex-apple-watch-s12-credit.ts
 *
 * Alex 287 (crédito 0d8110e4) se lleva un Apple Watch Series 12 GPS 42mm por
 * $1.500.000 dentro del mismo crédito. Saldo insoluto 1.080.859 + 1.500.000 =
 * 2.580.859 al 5% mensual, misma cuota 382.117: cuotas 4–12 (8 completas y la
 * #12 de 172.438). Las cuotas 1–3 pagadas (al 3%) quedan intactas.
 *
 * El reloj se pidió a Amazon (pedido 113-4106098-8017814, costo 1.210.000,
 * pagado hoy desde Lulo Bank Mireya) y aún no llega: entra con serial
 * provisional SN-FIC-000001, reservado para el crédito. Reemplazarlo por el
 * serial real al recibirlo (product_items y purchase_details).
 *
 * Run: npx tsx scripts/add-alex-apple-watch-s12-credit.ts
 */

import "dotenv/config";
import { randomUUID } from "node:crypto";
import Decimal from "decimal.js";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../src/db";
import {
  cashAccounts,
  layawayDetails,
  layaways,
  layawaySchedule,
  productItems,
  products,
  purchases,
  user,
} from "../src/db/schema";
import { PurchaseService } from "../src/services/purchase-service";
import { roundCOP, toDbString } from "../src/lib/money";

const LAYAWAY_ID = "0d8110e4-9afa-470f-9c0a-b8df6c5682bc";
const CATEGORY_ID = "8e1152ca-4726-4f72-ab9d-7d2f5cb63e25"; // Smartwatches
const AMAZON_PROVIDER_ID = "0f9d0167-4da7-42fe-b8bd-11399ea58747";
const INVOICE = "113-4106098-8017814";
const SERIAL = "SN-FIC-000001";

const PRODUCT_NAME = "Apple Watch Series 12 42mm Aluminio Dorado Claro";
const PRODUCT_ATTRS = { color: "Aluminio Dorado Claro", tamano: "42mm" };

const UNIT_COST = 1_210_000;
const SALE_PRICE = 1_500_000;
const PREV_OUTSTANDING = 1_080_859;
const NEW_PRINCIPAL = PREV_OUTSTANDING + SALE_PRICE; // 2.580.859
const NEW_RATE = 0.05;
const INSTALLMENT = 382_117;
const NEW_TOTAL_AMOUNT = 4_100_000 + SALE_PRICE;
const NEW_FINANCED_CAPITAL = 2_070_000 + SALE_PRICE;

// Hora de vencimiento de las cuotas existentes; febrero no tiene día 30.
const DUE_DATES = [
  "2026-11-30", "2026-12-30", "2027-01-30", "2027-02-28", "2027-03-30",
  "2027-04-30", "2027-05-30", "2027-06-30", "2027-07-30",
].map((d) => new Date(`${d}T14:19:04.085Z`));

function buildRows() {
  let balance = new Decimal(NEW_PRINCIPAL);
  const rows = DUE_DATES.map((dueDate, idx) => {
    const interest = roundCOP(balance.times(NEW_RATE));
    const isLast = balance.plus(interest).lte(INSTALLMENT);
    const principal = isLast ? balance : new Decimal(INSTALLMENT).minus(interest);
    balance = balance.minus(principal);
    return {
      number: 4 + idx,
      dueDate,
      principal: principal.toNumber(),
      interest: interest.toNumber(),
      totalAmount: principal.plus(interest).toNumber(),
      remainingBalance: balance.toNumber(),
    };
  });
  const last = rows[rows.length - 1];
  if (!balance.isZero() || last.totalAmount !== 172_438) {
    throw new Error(`Cronograma inesperado: saldo final ${balance}, última cuota ${last.totalAmount}`);
  }
  return rows;
}

async function findOrCreateProduct() {
  const [existing] = await db.select().from(products).where(eq(products.name, PRODUCT_NAME)).limit(1);
  if (existing) return existing;
  const suffix = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  const [created] = await db
    .insert(products)
    .values({
      categoryId: CATEGORY_ID,
      sku: `SMA-APPWAT-DORA-${suffix}`,
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
  const rows = buildRows();

  // --- Guardas del crédito (antes de escribir nada) ---
  const [lay] = await db.select().from(layaways).where(eq(layaways.id, LAYAWAY_ID)).limit(1);
  if (!lay) throw new Error("Crédito no encontrado");
  if (lay.status !== "active" || lay.type !== "credito") throw new Error(`Crédito en estado ${lay.status}/${lay.type}`);
  if (Number(lay.outstandingPrincipal) !== PREV_OUTSTANDING) {
    throw new Error(`Saldo insoluto ${lay.outstandingPrincipal} ≠ ${PREV_OUTSTANDING}; el crédito cambió`);
  }
  const pending = await db
    .select()
    .from(layawaySchedule)
    .where(and(eq(layawaySchedule.layawayId, LAYAWAY_ID), inArray(layawaySchedule.number, [4, 5, 6])));
  if (pending.length !== 3 || pending.some((s) => s.status !== "pendiente" || Number(s.paidAmount) > 0)) {
    throw new Error("Las cuotas 4–6 no están pendientes sin abonos; abortando");
  }

  const product = await findOrCreateProduct();
  const watchLine = await db
    .select({ id: layawayDetails.id })
    .from(layawayDetails)
    .where(and(eq(layawayDetails.layawayId, LAYAWAY_ID), eq(layawayDetails.productId, product.id)));
  if (watchLine.length > 0) throw new Error("El crédito ya tiene el Apple Watch; abortando");

  // --- Compra Amazon (reutiliza si ya quedó registrada en una corrida previa) ---
  const [existingPurchase] = await db.select().from(purchases).where(eq(purchases.invoiceNumber, INVOICE)).limit(1);
  if (!existingPurchase) {
    const [lulo] = await db.select().from(cashAccounts).where(eq(cashAccounts.name, "Lulo Bank Mireya")).limit(1);
    if (!lulo) throw new Error("Cuenta Lulo Bank Mireya no encontrada");
    const [owner] = await db.select().from(user).where(eq(user.email, "fransteven1998@gmail.com")).limit(1);
    if (!owner) throw new Error("Usuario admin no encontrado");

    const purchase = await PurchaseService.createPurchase({
      idempotencyKey: randomUUID(),
      providerId: AMAZON_PROVIDER_ID,
      purchaseDate: new Date(),
      invoiceNumber: INVOICE,
      notes: `Pedido en tránsito para el crédito de Alex 287 (#${LAYAWAY_ID.slice(0, 8)}). Cambiar ${SERIAL} por el serial real al recibir.`,
      details: [
        {
          productId: product.id,
          quantity: 1,
          unitCost: UNIT_COST,
          serialNumbers: [SERIAL],
          condition: "new",
          notes: "Color: Aluminio Dorado Claro · GPS",
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

  // --- Ajuste del crédito ---
  await db.transaction(async (tx) => {
    await tx.update(productItems).set({ status: "reserved" }).where(eq(productItems.id, item.id));

    await tx.insert(layawayDetails).values({
      layawayId: LAYAWAY_ID,
      productId: product.id,
      productItemId: item.id,
      quantity: 1,
      agreedPrice: toDbString(SALE_PRICE),
      unitCost: toDbString(UNIT_COST),
    });

    await tx
      .update(layaways)
      .set({
        totalAmount: toDbString(NEW_TOTAL_AMOUNT),
        financedCapital: toDbString(NEW_FINANCED_CAPITAL),
        outstandingPrincipal: toDbString(NEW_PRINCIPAL),
        interestRate: NEW_RATE.toFixed(4),
        termMonths: 12,
        installmentAmount: toDbString(INSTALLMENT),
        expiresAt: DUE_DATES[DUE_DATES.length - 1],
      })
      .where(eq(layaways.id, LAYAWAY_ID));

    await tx
      .delete(layawaySchedule)
      .where(and(eq(layawaySchedule.layawayId, LAYAWAY_ID), inArray(layawaySchedule.number, [4, 5, 6])));
    await tx.insert(layawaySchedule).values(
      rows.map((r) => ({
        layawayId: LAYAWAY_ID,
        number: r.number,
        dueDate: r.dueDate,
        principal: toDbString(r.principal),
        interest: toDbString(r.interest),
        totalAmount: toDbString(r.totalAmount),
        remainingBalance: toDbString(r.remainingBalance),
        status: "pendiente" as const,
      }))
    );
  });

  console.table(rows);
  console.log("✅ Apple Watch agregado: saldo 2.580.859 al 5% · cuotas 4–12 de 382.117 (última 172.438)");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
