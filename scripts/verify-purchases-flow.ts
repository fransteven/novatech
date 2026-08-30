import "dotenv/config";
import { db } from "../src/db";
import {
  purchases,
  purchaseDetails,
  purchaseExtraCosts,
  purchasePayments,
  productItems,
  inventoryMovements,
  cashMovements,
  providers,
  products,
  cashAccounts,
  user,
} from "../src/db/schema";
import { PurchaseService } from "../src/services/purchase-service";
import { eq, and, inArray, sql } from "drizzle-orm";

const createdPurchaseIds: string[] = [];
let tempProviderId: string | null = null;
let tempProductId: string | null = null;

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(`ASSERT FALLÓ: ${message}`);
  console.log(`  ✓ ${message}`);
};

const cleanup = async () => {
  // Se barre por el proveedor temporal: así también se limpian las compras que
  // un escenario haya creado sin que el script alcanzara a registrar su id.
  if (tempProviderId) {
    const rows = await db
      .select({ id: purchases.id })
      .from(purchases)
      .where(eq(purchases.providerId, tempProviderId));
    for (const row of rows) {
      if (!createdPurchaseIds.includes(row.id)) createdPurchaseIds.push(row.id);
    }
  }

  if (createdPurchaseIds.length > 0) {
    const itemIds = (
      await db
        .select({ id: purchaseDetails.productItemId })
        .from(purchaseDetails)
        .where(inArray(purchaseDetails.purchaseId, createdPurchaseIds))
    )
      .map((row) => row.id)
      .filter((id): id is string => Boolean(id));

    await db
      .delete(purchasePayments)
      .where(inArray(purchasePayments.purchaseId, createdPurchaseIds));
    await db
      .delete(cashMovements)
      .where(
        and(
          eq(cashMovements.sourceType, "purchase_payment"),
          inArray(cashMovements.sourceId, createdPurchaseIds),
        ),
      );
    await db
      .delete(purchaseDetails)
      .where(inArray(purchaseDetails.purchaseId, createdPurchaseIds));
    await db
      .delete(purchaseExtraCosts)
      .where(inArray(purchaseExtraCosts.purchaseId, createdPurchaseIds));

    const reasons = createdPurchaseIds.map((id) => `Compra #${id.slice(0, 8)}`);
    await db
      .delete(inventoryMovements)
      .where(inArray(inventoryMovements.reason, reasons));

    if (itemIds.length > 0) {
      await db.delete(productItems).where(inArray(productItems.id, itemIds));
    }

    await db.delete(purchases).where(inArray(purchases.id, createdPurchaseIds));
  }

  if (tempProviderId) {
    await db.delete(providers).where(eq(providers.id, tempProviderId));
  }
  if (tempProductId) {
    await db.delete(products).where(eq(products.id, tempProductId));
  }
  console.log("\n🧹 Limpieza completa: no quedó ningún rastro de la prueba.");
};

const main = async () => {
  const [testUser] = await db.select({ id: user.id }).from(user).limit(1);
  const [account] = await db
    .select({ id: cashAccounts.id, name: cashAccounts.name })
    .from(cashAccounts)
    .where(eq(cashAccounts.isActive, true))
    .limit(1);
  const [serialized] = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(eq(products.isSerialized, true))
    .limit(1);
  if (!testUser || !account || !serialized) {
    throw new Error(
      "Faltan datos base (usuario, cuenta de caja activa o producto serializado).",
    );
  }

  // El catálogo real puede no tener productos no serializados: se crea uno
  // temporal para probar ese camino y se borra al final.
  let [generic] = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(eq(products.isSerialized, false))
    .limit(1);

  if (!generic) {
    const [created] = await db
      .insert(products)
      .values({
        name: `ZZ VERIFICACIÓN GENÉRICO ${Date.now()}`,
        price: "30000",
        isSerialized: false,
      })
      .returning({ id: products.id, name: products.name });
    generic = created;
    tempProductId = created.id;
  }

  const [provider] = await db
    .insert(providers)
    .values({ name: `ZZ VERIFICACIÓN ${Date.now()}` })
    .returning();
  tempProviderId = provider.id;

  const serialA = `TEST${Date.now()}A`;
  const serialB = `TEST${Date.now()}B`;

  // ---------- 1. Compra de contado con costos adicionales ----------
  console.log("\n[1] Compra de contado, serializada, con costos adicionales");
  const purchase1 = await PurchaseService.createPurchase({
    idempotencyKey: crypto.randomUUID(),
    providerId: provider.id,
    details: [
      {
        productId: serialized.id,
        quantity: 2,
        unitCost: 1_000_000,
        serialNumbers: [serialA, serialB],
        conditionDetails: { batteryHealth: 92 },
      },
      { productId: generic.id, quantity: 5, unitCost: 20_000 },
    ],
    extraCosts: [{ concept: "Flete", amount: 210_000 }],
    amountPaid: 2_310_000,
    accountId: account.id,
    paymentMethod: "transfer",
    expectedTotal: 2_310_000,
    userId: testUser.id,
  });
  createdPurchaseIds.push(purchase1.id);

  assert(purchase1.paymentStatus === "paid", "estado de pago = paid");
  assert(Number(purchase1.totalAmount) === 2_310_000, "total = subtotal + extras");
  assert(
    Number(purchase1.subtotalAmount) === 2_100_000,
    "subtotal recalculado en el servidor",
  );

  const items = await db
    .select({
      id: productItems.id,
      serialNumber: productItems.serialNumber,
      unitCost: productItems.unitCost,
    })
    .from(productItems)
    .where(inArray(productItems.serialNumber, [serialA, serialB]));

  assert(items.length === 2, "se crearon 2 product_items serializados");
  // 210.000 prorrateado: 2.000.000/2.100.000 → 200.000 a la línea serializada (100.000 c/u)
  assert(
    items.every((item) => Number(item.unitCost) === 1_100_000),
    "costo aterrizado por equipo = 1.100.000 (costo + flete prorrateado)",
  );

  const movements = await db
    .select({
      productItemId: inventoryMovements.productItemId,
      quantity: inventoryMovements.quantity,
      unitCost: inventoryMovements.unitCost,
    })
    .from(inventoryMovements)
    .where(eq(inventoryMovements.reason, `Compra #${purchase1.id.slice(0, 8)}`));

  assert(movements.length === 3, "3 movimientos IN (2 seriales + 1 genérico)");
  const genericMovement = movements.find((m) => m.productItemId === null);
  assert(
    Number(genericMovement?.unitCost) === 22_000 &&
      genericMovement?.quantity === 5,
    "línea genérica: 5 unidades a 22.000 (costo aterrizado)",
  );

  const [cashOut] = await db
    .select({ amount: cashMovements.amount, direction: cashMovements.direction })
    .from(cashMovements)
    .where(
      and(
        eq(cashMovements.sourceType, "purchase_payment"),
        eq(cashMovements.sourceId, purchase1.id),
      ),
    );
  assert(
    cashOut?.direction === "out" && Number(cashOut.amount) === 2_310_000,
    "egreso de caja por el total",
  );

  const payments1 = await db
    .select()
    .from(purchasePayments)
    .where(eq(purchasePayments.purchaseId, purchase1.id));
  assert(payments1.length === 1, "el pago de contado quedó en purchase_payments");

  // ---------- 2. Idempotencia ----------
  console.log("\n[2] Doble submit con la misma llave");
  const sameKey = crypto.randomUUID();
  const first = await PurchaseService.createPurchase({
    idempotencyKey: sameKey,
    providerId: provider.id,
    details: [{ productId: generic.id, quantity: 1, unitCost: 10_000 }],
    amountPaid: 0,
    paymentMethod: "transfer",
    userId: testUser.id,
  });
  createdPurchaseIds.push(first.id);
  const second = await PurchaseService.createPurchase({
    idempotencyKey: sameKey,
    providerId: provider.id,
    details: [{ productId: generic.id, quantity: 1, unitCost: 10_000 }],
    amountPaid: 0,
    paymentMethod: "transfer",
    userId: testUser.id,
  });
  assert(first.id === second.id, "el segundo intento devuelve la misma compra");

  // ---------- 3. Compra a crédito + abonos ----------
  console.log("\n[3] Compra a crédito y abonos");
  assert(first.paymentStatus === "pending", "sin pago → estado pending");
  const creditCash = await db
    .select()
    .from(cashMovements)
    .where(
      and(
        eq(cashMovements.sourceType, "purchase_payment"),
        eq(cashMovements.sourceId, first.id),
      ),
    );
  assert(creditCash.length === 0, "una compra a crédito NO toca caja");

  await PurchaseService.registerPurchasePayment({
    purchaseId: first.id,
    amount: 4_000,
    accountId: account.id,
    paymentMethod: "cash",
    idempotencyKey: crypto.randomUUID(),
    userId: testUser.id,
  });
  const afterPartial = await PurchaseService.getPurchaseById(first.id);
  assert(afterPartial?.paymentStatus === "partial", "abono parcial → partial");
  assert(afterPartial?.pendingAmount === 6_000, "saldo pendiente = 6.000");

  await PurchaseService.registerPurchasePayment({
    purchaseId: first.id,
    amount: 6_000,
    accountId: account.id,
    paymentMethod: "cash",
    idempotencyKey: crypto.randomUUID(),
    userId: testUser.id,
  });
  const afterFull = await PurchaseService.getPurchaseById(first.id);
  assert(afterFull?.paymentStatus === "paid", "saldo cubierto → paid");
  assert(afterFull?.payments.length === 2, "quedaron 2 abonos registrados");

  let overpaid = false;
  try {
    await PurchaseService.registerPurchasePayment({
      purchaseId: first.id,
      amount: 1_000,
      accountId: account.id,
      paymentMethod: "cash",
      idempotencyKey: crypto.randomUUID(),
      userId: testUser.id,
    });
  } catch {
    overpaid = true;
  }
  assert(overpaid, "no deja abonar sobre una compra ya pagada");

  // ---------- 4. Validaciones que protegen el inventario ----------
  console.log("\n[4] Validaciones");

  const countBefore = await db
    .select({ c: sql<number>`COUNT(*)::int` })
    .from(purchases);

  let duplicateBlocked = false;
  try {
    await PurchaseService.createPurchase({
      idempotencyKey: crypto.randomUUID(),
      providerId: provider.id,
      details: [
        {
          productId: serialized.id,
          quantity: 1,
          unitCost: 500_000,
          serialNumbers: [serialA],
        },
      ],
      amountPaid: 0,
      paymentMethod: "transfer",
      userId: testUser.id,
    });
  } catch (error) {
    duplicateBlocked = String(error).includes("ya registrado");
  }
  assert(duplicateBlocked, "rechaza un serial que ya existe en inventario");

  let batchDuplicateBlocked = false;
  try {
    await PurchaseService.createPurchase({
      idempotencyKey: crypto.randomUUID(),
      providerId: provider.id,
      details: [
        {
          productId: serialized.id,
          quantity: 2,
          unitCost: 500_000,
          serialNumbers: ["DUP-1", " dup-1 "],
        },
      ],
      amountPaid: 0,
      paymentMethod: "transfer",
      userId: testUser.id,
    });
  } catch (error) {
    batchDuplicateBlocked = String(error).includes("repetido");
  }
  assert(batchDuplicateBlocked, "rechaza seriales repetidos dentro del payload");

  let missingSerialsBlocked = false;
  try {
    await PurchaseService.createPurchase({
      idempotencyKey: crypto.randomUUID(),
      providerId: provider.id,
      details: [
        { productId: serialized.id, quantity: 2, unitCost: 500_000 },
      ],
      amountPaid: 0,
      paymentMethod: "transfer",
      userId: testUser.id,
    });
  } catch (error) {
    missingSerialsBlocked = String(error).includes("serial");
  }
  assert(
    missingSerialsBlocked,
    "un producto serializado sin seriales no entra al inventario",
  );

  let mismatchBlocked = false;
  try {
    await PurchaseService.createPurchase({
      idempotencyKey: crypto.randomUUID(),
      providerId: provider.id,
      details: [{ productId: generic.id, quantity: 1, unitCost: 10_000 }],
      amountPaid: 0,
      paymentMethod: "transfer",
      expectedTotal: 999_999,
      userId: testUser.id,
    });
  } catch (error) {
    mismatchBlocked = String(error).includes("no coincide");
  }
  assert(mismatchBlocked, "rechaza un total que no coincide con las líneas");

  const countAfter = await db
    .select({ c: sql<number>`COUNT(*)::int` })
    .from(purchases);
  assert(
    countBefore[0].c === countAfter[0].c,
    "ningún intento inválido dejó compras a medias",
  );

  console.log("\n✅ Todos los escenarios pasaron.");
};

main()
  .then(cleanup)
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error("\n❌", error);
    await cleanup().catch((cleanupError) =>
      console.error("Error limpiando:", cleanupError),
    );
    process.exit(1);
  });
