import "dotenv/config";
import { db } from "../src/db";
import { categories } from "../src/db/schema/inventory";
import { eq } from "drizzle-orm";
import { categorySchema } from "../src/lib/validators/category-validator";
import type { CategoryInput } from "../src/lib/validators/category-validator";

const categoryData: CategoryInput = {
  name: "Controles PlayStation 5",
  description: "Mandos y controles para PlayStation 5 (DualSense, DualSense Edge y licenciados)",
  template: [
    {
      key: "model",
      label: "Modelo de control",
      type: "select",
      options: ["DualSense Estándar", "DualSense Edge", "Pro / Licenciado"],
    },
    {
      key: "color",
      label: "Color",
      type: "select",
      options: [
        "Blanco Clásico",
        "Midnight Black",
        "Cosmic Red",
        "Starlight Blue",
        "Galactic Purple",
        "Nova Pink",
        "Grey Camouflage",
        "Volcanic Red",
        "Cobalt Blue",
        "Sterling Silver",
        "Chroma Pearl",
        "Chroma Indigo",
        "Chroma Teal",
        "Otro",
      ],
    },
    {
      key: "edition",
      label: "Edición",
      type: "select",
      options: [
        "Estándar",
        "30th Anniversary Limited Edition",
        "Spider-Man 2",
        "Astro Bot",
        "God of War Ragnarök",
        "Fortnite",
        "Hogwarts Legacy",
        "Otra Edición Especial",
      ],
    },
    {
      key: "brand",
      label: "Marca",
      type: "select",
      options: [
        "Sony (Original)",
        "Scuf",
        "Razer",
        "Nacon",
        "Victrix",
        "Otra",
      ],
    },
    {
      key: "connectivity",
      label: "Conectividad",
      type: "select",
      options: [
        "Inalámbrico (Bluetooth / USB-C)",
        "Inalámbrico 2.4 GHz + USB-C",
        "Cableado USB-C",
      ],
    },
    {
      key: "packaging_type",
      label: "Tipo de empaque",
      type: "select",
      options: [
        "Caja Sellada Retail",
        "OEM / Bulk (Sin Caja)",
        "Bundle",
      ],
    },
    {
      key: "hardware_revision",
      label: "Revisión de placa (BDM)",
      type: "select",
      options: [
        "BDM-010",
        "BDM-020",
        "BDM-030",
        "BDM-040",
        "BDM-050",
        "N/A",
      ],
    },
    {
      key: "compatibility",
      label: "Compatibilidad",
      type: "text",
      options: [],
    },
  ],
};

async function main() {
  // 1. Validar contra el esquema oficial Zod
  const validated = categorySchema.parse(categoryData);

  // 2. Verificar existencia previa
  const existing = await db
    .select()
    .from(categories)
    .where(eq(categories.name, validated.name));

  if (existing.length > 0) {
    console.log(`Categoría '${validated.name}' ya existe con ID:`, existing[0].id);
    console.log(JSON.stringify(existing[0], null, 2));
    process.exit(0);
  }

  // 3. Insertar la nueva categoría
  const [created] = await db
    .insert(categories)
    .values(validated)
    .returning();

  console.log("✅ Categoría creada exitosamente:");
  console.log(JSON.stringify(created, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error creando categoría:", err);
  process.exit(1);
});
