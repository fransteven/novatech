import "dotenv/config";
import { db } from "../src/db";
import { categories } from "../src/db/schema/inventory";
import { eq } from "drizzle-orm";
import type { CategoryAttribute } from "../src/lib/validators/category-validator";

const template: CategoryAttribute[] = [
  {
    key: "tipo",
    label: "Tipo",
    type: "select",
    options: ["In-ear (TWS)", "Diadema", "Deportivos", "Con cable"],
  },
  {
    key: "conectividad",
    label: "Conectividad",
    type: "select",
    options: ["Bluetooth", "Cable 3.5mm", "USB-C", "Lightning"],
  },
  {
    key: "cancelacion_ruido",
    label: "Cancelación de ruido",
    type: "select",
    options: ["Sí (ANC)", "No"],
  },
  {
    key: "color",
    label: "Color",
    type: "select",
    options: ["Blanco", "Negro", "Azul", "Rosado", "Morado"],
  },
];

async function main() {
  const existing = await db
    .select()
    .from(categories)
    .where(eq(categories.name, "Audífonos"));

  if (existing.length > 0) {
    console.log("Categoría 'Audífonos' ya existe:", existing[0].id);
    process.exit(0);
  }

  const [created] = await db
    .insert(categories)
    .values({
      name: "Audífonos",
      description: "Audífonos y manos libres",
      template,
    })
    .returning();

  console.log("Creada:", JSON.stringify(created, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
