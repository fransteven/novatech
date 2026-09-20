import "dotenv/config";
import { db } from "../src/db";
import { categories } from "../src/db/schema/inventory";
import { eq } from "drizzle-orm";
import { categoryAttributeSchema } from "../src/lib/validators/category-validator";
import type { CategoryAttribute } from "../src/lib/validators/category-validator";

const template: CategoryAttribute[] = [
  {
    key: "storage",
    label: "Almacenamiento",
    type: "select",
    options: ["32GB", "64GB", "500GB", "512GB", "825GB", "1TB", "2TB"],
  },
  {
    key: "controls",
    label: "N° de controles",
    type: "number",
    options: [],
  },
  {
    key: "special_edition",
    label: "Edición especial",
    type: "select",
    options: ["Sí", "No"],
  },
];

async function main() {
  // Falla temprano si el template no cumple el contrato del validador.
  template.forEach((attr) => categoryAttributeSchema.parse(attr));

  const [updated] = await db
    .update(categories)
    .set({ template })
    .where(eq(categories.name, "Consolas"))
    .returning();

  if (!updated) {
    console.error("No existe la categoría 'Consolas'.");
    process.exit(1);
  }

  console.log("Actualizada:", JSON.stringify(updated, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
