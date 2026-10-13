/**
 * Backfill de códigos de barras (serial de caja + UPC) de los cargadores de la
 * compra a Brayan Vilaró del 05-10-2026 (factura 20261005901383474SRV).
 * Idempotente: re-ejecutarlo no duplica códigos.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { products } from "../src/db/schema";
import { addProductBarcodes } from "../src/services/product-barcode-service";

const BARCODES: Record<string, string[]> = {
  "Adaptador de corriente USB-C 20W (MHJ83LL/A)": ["F1641522J33PMG9DW", "942521569409"],
  "Adaptador de corriente 40W Dynamic (MGKN4AM/A)": [
    "F16HKE0051F0000NXY",
    "F16HAKYXR0K0004XDG",
    "F16HAK9KGSK0004XDG",
    "F16HAKT2Q5K0004XDG",
    "195950665963",
  ],
};

async function main() {
  for (const [name, codes] of Object.entries(BARCODES)) {
    const [product] = await db.select().from(products).where(eq(products.name, name)).limit(1);
    if (!product) throw new Error(`Producto "${name}" no encontrado`);
    const inserted = await addProductBarcodes(db, product.id, codes);
    console.log(`${name}: ${inserted.length} código(s) nuevo(s) de ${codes.length}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
