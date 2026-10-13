/**
 * Compra Brayan Vilaró 05-10-2026 · Ref. 20261005901383474SRV / 001791210055445.
 * 10 adaptadores 20W USB-C (MHJ83LL/A, A2305) @ $40.000 y 6 adaptadores 40W
 * Dynamic (MGKN4AM/A, A3351) @ $55.000 = $730.000. El proveedor sumó $770.000
 * (+ 4x1000 = $773.000); se aclaró y queda saldo a favor. Se registra sobre la
 * base real: 4x1000 de $2.920 + flete $32.600 como costos adicionales, que el
 * servicio prorratea por valor. Seriales de caja repetidos → productos NO
 * serializados. Pago desde "Lulo Bank Mireya" vía PurchaseService.createPurchase.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "../src/db";
import { categories, products, cashAccounts, providers, purchases, user } from "../src/db/schema";
import { PurchaseService } from "../src/services/purchase-service";
import { generateBaseSKU } from "../src/lib/utils";

const INVOICE_NUMBER = "20261005901383474SRV";
const REFERENCE_CODE = "001791210055445";
const GMF = 2_920; // 730.000 × 4/1000
const FREIGHT = 32_600;

const LINES = [
  {
    name: "Adaptador de corriente USB-C 20W (MHJ83LL/A)",
    description: "Adaptador Apple 20W USB-C, modelo A2305 (MHJ83LL/A).",
    price: "80000",
    quantity: 10,
    unitCost: 40_000,
    attributes: { potencia: "20W", conector: "USB-C", modelo: "A2305", color: "Blanco" },
  },
  {
    name: "Adaptador de corriente 40W Dynamic (MGKN4AM/A)",
    description: "Adaptador Apple 40W Dynamic Power Adapter con 60W Max, modelo A3351 (MGKN4AM/A).",
    price: "120000",
    quantity: 6,
    unitCost: 55_000,
    attributes: { potencia: "40W (60W máx)", conector: "USB-C", modelo: "A3351", color: "Blanco" },
  },
];

const SUBTOTAL = LINES.reduce((acc, l) => acc + l.quantity * l.unitCost, 0);
const TOTAL = SUBTOTAL + GMF + FREIGHT;

async function main() {
  if (SUBTOTAL !== 730_000) throw new Error("Subtotal no cuadra con $730.000");

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

  const [category] = await db.select().from(categories).where(eq(categories.name, "Accesorios")).limit(1);
  if (!category) throw new Error("Categoría 'Accesorios' no encontrada");

  const [dup] = await db
    .select({ id: purchases.id })
    .from(purchases)
    .where(eq(purchases.invoiceNumber, INVOICE_NUMBER))
    .limit(1);
  if (dup) throw new Error(`La factura ${INVOICE_NUMBER} ya está registrada → ${dup.id}`);

  // --- Productos (no serializados) ---
  const details = [];
  for (const line of LINES) {
    let [product] = await db
      .select()
      .from(products)
      .where(sql`TRIM(LOWER(${products.name})) = TRIM(LOWER(${line.name}))`)
      .limit(1);

    if (product) {
      if (product.isSerialized) throw new Error(`"${line.name}" existe pero es serializado`);
      console.log(`Producto "${line.name}" ya existía → ${product.id}`);
    } else {
      const suffix = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
      const sku = `${generateBaseSKU(category.name, line.name, line.attributes)}-${suffix}`;
      [product] = await db
        .insert(products)
        .values({
          name: line.name,
          description: line.description,
          sku,
          categoryId: category.id,
          price: line.price,
          isSerialized: false,
          attributes: line.attributes,
        })
        .returning();
      console.log(`Producto "${line.name}" creado → ${product.id} (SKU ${product.sku})`);
    }

    details.push({
      productId: product.id,
      quantity: line.quantity,
      unitCost: line.unitCost,
      condition: "new" as const,
    });
  }

  // --- Compra ---
  const purchase = await PurchaseService.createPurchase({
    idempotencyKey: randomUUID(),
    providerId: provider.id,
    purchaseDate: new Date(2026, 9, 5, 12, 0, 0), // 05-10-2026 mediodía local
    invoiceNumber: INVOICE_NUMBER,
    notes: [
      "Proveedor sumó $770.000 (+4x1000 $3.100 = $773.000); base real $730.000. Saldo a favor con el proveedor: $40.080.",
      "Seriales de caja 20W: los 10 repiten F1641522J33PMG9DW.",
      "Seriales de caja 40W: 3× F16HKE0051F0000NXY, F16HAKYXR0K0004XDG, F16HAK9KGSK0004XDG, F16HAKT2Q5K0004XDG.",
    ].join(" "),
    details,
    extraCosts: [
      { concept: "4x1000 (GMF)", amount: GMF },
      { concept: "Flete", amount: FREIGHT },
    ],
    amountPaid: TOTAL,
    accountId: account.id,
    paymentMethod: "transfer",
    referenceCode: REFERENCE_CODE,
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
