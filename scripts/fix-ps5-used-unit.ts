import "dotenv/config";
import { db } from "../src/db";
import { products, productItems } from "../src/db/schema/inventory";
import { eq } from "drizzle-orm";

/**
 * La única PlayStation 5 del inventario entró como parte de pago de un crédito:
 * es un equipo de segunda. Este script la marca como tal y limpia el atributo
 * de catálogo `incluye`, que describía esa unidad concreta (no el modelo) y
 * quedó fuera del template de la categoría Consolas.
 *
 * No se toca `warrantyMonths` de la unidad: ya está vendida y entregada con la
 * cobertura por defecto de la casa; fijarle meses ahora se la recortaría
 * retroactivamente.
 *
 * Idempotente: correrlo dos veces no cambia nada la segunda vez.
 */
const PRODUCT_NAME = "PlayStation 5";
const SERIAL = "C0304812457391";

async function main() {
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.name, PRODUCT_NAME));

  if (!product) {
    console.error(`No existe el producto '${PRODUCT_NAME}'.`);
    process.exit(1);
  }

  const [item] = await db
    .select()
    .from(productItems)
    .where(eq(productItems.serialNumber, SERIAL));

  if (!item) {
    console.error(`No existe la unidad con serial ${SERIAL}.`);
    process.exit(1);
  }

  if (item.condition === "used") {
    console.log(`Unidad ${SERIAL} ya está marcada como 'used'.`);
  } else {
    await db
      .update(productItems)
      .set({ condition: "used" })
      .where(eq(productItems.id, item.id));
    console.log(`Unidad ${SERIAL}: condition '${item.condition}' → 'used'.`);
  }

  const attributes = (product.attributes ?? {}) as Record<string, unknown>;

  if (!("incluye" in attributes)) {
    console.log("El catálogo ya no tiene el atributo 'incluye'.");
  } else {
    // El contenido del paquete ya vive en las notas de la unidad:
    // "Incluye 2 controles + 1 juego".
    const { incluye, ...rest } = attributes;
    await db
      .update(products)
      .set({ attributes: rest, updatedAt: new Date() })
      .where(eq(products.id, product.id));
    console.log(`Catálogo: atributo 'incluye' eliminado (era "${incluye}").`);
    console.log(`Notas de la unidad (se conservan): ${item.notes}`);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
