/**
 * AirPods Pro 3 (Réplica AAA): LTOJFPRXQH es la referencia del lote (como un
 * ISBN), no un serial por unidad. Se usa como SKU del producto para que el POS
 * lo encuentre al escanear/escribir la referencia, y se corrige la nota de la
 * compra M14134419.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { products, purchases } from "../src/db/schema";

const PRODUCT_ID = "f2b046a4-dfd3-4761-af6f-cc0e2f3ad6e7";
const PURCHASE_ID = "2d2cd93a-6792-4bb8-8f69-8256f295575d";
const REFERENCE = "LTOJFPRXQH";

async function main() {
  await db.transaction(async (tx) => {
    const [taken] = await tx.select({ id: products.id }).from(products).where(eq(products.sku, REFERENCE));
    if (taken && taken.id !== PRODUCT_ID) throw new Error(`SKU ${REFERENCE} ya usado por ${taken.id}`);

    const [product] = await tx
      .update(products)
      .set({ sku: REFERENCE, updatedAt: new Date() })
      .where(eq(products.id, PRODUCT_ID))
      .returning({ id: products.id, sku: products.sku });
    if (!product) throw new Error("Producto no encontrado");

    const [purchase] = await tx
      .update(purchases)
      .set({
        notes: `Total $251.000 + $18.500 prorrateado en el costo unitario. Referencia del lote (SKU del producto): ${REFERENCE}.`,
        updatedAt: new Date(),
      })
      .where(eq(purchases.id, PURCHASE_ID))
      .returning({ id: purchases.id, notes: purchases.notes });
    if (!purchase) throw new Error("Compra no encontrada");

    console.log(product, purchase);
  });
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
