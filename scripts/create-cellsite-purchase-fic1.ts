/**
 * Compra Cellsite 18-09-2026 · Factura FIC-0000001.
 * Crea (si faltan) las categorías Tablets y Accesorios, los productos
 * Apple Pencil (USB-C) e iPad (A16) Wi-Fi 128GB, y registra la compra de
 * contado desde "Efectivo Juan Diego" vía PurchaseService.createPurchase.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "../src/db";
import { categories, products, cashAccounts, providers, user } from "../src/db/schema";
import { PurchaseService } from "../src/services/purchase-service";
import { getNextFictitiousInvoiceNumber } from "../src/lib/fictitious-documents";
import { generateBaseSKU } from "../src/lib/utils";
import type { CategoryAttribute } from "../src/lib/validators/category-validator";

const TABLETS_TEMPLATE: CategoryAttribute[] = [
  { key: "storage", label: "Almacenamiento", type: "select", options: ["64", "128", "256", "512", "1024"] },
  { key: "conectividad", label: "Conectividad", type: "select", options: ["Wi-Fi", "Wi-Fi + Cellular"] },
  { key: "chip", label: "Chip", type: "text", options: [] },
  { key: "tamano_pantalla", label: "Tamaño de pantalla", type: "text", options: [] },
  { key: "color", label: "Color", type: "select", options: ["Plata", "Gris espacial", "Azul", "Rosado", "Amarillo", "Blanco", "Negro"] },
];

const ACCESORIOS_TEMPLATE: CategoryAttribute[] = [
  { key: "tipo", label: "Tipo", type: "select", options: ["Lápiz óptico", "Cargador", "Cable", "Funda", "Vidrio templado", "Adaptador", "Soporte", "Otro"] },
  { key: "marca", label: "Marca", type: "text", options: [] },
  { key: "conectividad", label: "Conectividad", type: "select", options: ["USB-C", "Lightning", "Bluetooth", "Cable 3.5mm", "Inalámbrico", "N/A"] },
  { key: "color", label: "Color", type: "select", options: ["Blanco", "Negro", "Gris", "Azul", "Otro"] },
];

const ensureCategory = async (
  name: string,
  description: string,
  template: CategoryAttribute[],
) => {
  const [found] = await db.select().from(categories).where(eq(categories.name, name)).limit(1);
  if (found) {
    console.log(`Categoría "${name}" ya existía → ${found.id}`);
    return found;
  }
  const [created] = await db
    .insert(categories)
    .values({ name, description, template })
    .returning();
  console.log(`Categoría "${name}" creada → ${created.id}`);
  return created;
};

const ensureProduct = async (input: {
  name: string;
  categoryId: string;
  categoryName: string;
  price: string;
  attributes: Record<string, string>;
  description: string;
}) => {
  const attrsJson = JSON.stringify(input.attributes);
  const [found] = await db
    .select()
    .from(products)
    .where(
      sql`TRIM(LOWER(${products.name})) = TRIM(LOWER(${input.name}))
          AND COALESCE((${products.attributes})::text, '') = ${attrsJson}`,
    )
    .limit(1);

  if (found) {
    console.log(`Producto "${input.name}" ya existía → ${found.id}`);
    return found;
  }

  const suffix = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  const sku = `${generateBaseSKU(input.categoryName, input.name, input.attributes)}-${suffix}`;

  const [created] = await db
    .insert(products)
    .values({
      name: input.name,
      description: input.description,
      sku,
      categoryId: input.categoryId,
      price: input.price,
      isSerialized: true,
      attributes: input.attributes,
    })
    .returning();
  console.log(`Producto "${input.name}" creado → ${created.id} (SKU ${created.sku})`);
  return created;
};

async function main() {
  // --- Referencias existentes ---
  const [provider] = await db.select().from(providers).where(eq(providers.name, "Cellsite")).limit(1);
  if (!provider) throw new Error("Proveedor Cellsite no encontrado");

  const [account] = await db
    .select()
    .from(cashAccounts)
    .where(eq(cashAccounts.name, "Efectivo Juan Diego"))
    .limit(1);
  if (!account) throw new Error("Cuenta 'Efectivo Juan Diego' no encontrada");

  const [owner] = await db.select().from(user).where(eq(user.email, "fransteven1998@gmail.com")).limit(1);
  if (!owner) throw new Error("Usuario admin no encontrado");

  // --- Factura ficticia: debe coincidir con el consecutivo libre ---
  const nextInvoice = await getNextFictitiousInvoiceNumber();
  const invoiceNumber = "FIC-0000001";
  if (nextInvoice !== invoiceNumber) {
    throw new Error(
      `El consecutivo ficticio libre es ${nextInvoice}, no ${invoiceNumber}. Aborto para no romper la convención.`,
    );
  }

  // --- Categorías ---
  const tablets = await ensureCategory("Tablets", "Tablets y iPads", TABLETS_TEMPLATE);
  const accesorios = await ensureCategory(
    "Accesorios",
    "Accesorios y periféricos (lápices, cargadores, cables, fundas)",
    ACCESORIOS_TEMPLATE,
  );

  // --- Productos ---
  const pencil = await ensureProduct({
    name: "Apple Pencil (USB-C)",
    categoryId: accesorios.id,
    categoryName: accesorios.name,
    price: "430000",
    description: "Lápiz óptico Apple con carga USB-C",
    attributes: { tipo: "Lápiz óptico", marca: "Apple", conectividad: "USB-C", color: "Blanco" },
  });

  const ipad = await ensureProduct({
    name: "iPad (A16) Wi-Fi 128GB",
    categoryId: tablets.id,
    categoryName: tablets.name,
    price: "1910000",
    description: "iPad con chip A16, Wi-Fi, 128GB",
    attributes: { storage: "128", conectividad: "Wi-Fi", chip: "A16", tamano_pantalla: '11"' },
  });

  // --- Compra ---
  const purchaseDate = new Date(2026, 8, 18, 12, 0, 0); // 18-09-2026 mediodía local
  const total = 330000 + 1470000;

  const purchase = await PurchaseService.createPurchase({
    idempotencyKey: randomUUID(),
    providerId: provider.id,
    purchaseDate,
    invoiceNumber,
    details: [
      {
        productId: pencil.id,
        quantity: 1,
        unitCost: 330000,
        serialNumbers: ["C7YY79JL9R"],
        condition: "new",
      },
      {
        productId: ipad.id,
        quantity: 1,
        unitCost: 1470000,
        serialNumbers: ["G7KOH4XRKX"],
        condition: "new",
      },
    ],
    amountPaid: total,
    accountId: account.id,
    paymentMethod: "cash",
    referenceCode: invoiceNumber,
    expectedTotal: total,
    userId: owner.id,
  });

  console.log("\nCompra registrada:", JSON.stringify(purchase, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
