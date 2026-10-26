/**
 * Categorías iniciales de Masterplay (videojuegos, consolas, accesorios,
 * juguetes). Idempotente por nombre: si la categoría existe, sólo actualiza su
 * template. Ejecutar SOLO contra la BD de Masterplay:
 *
 *   npx tsx scripts/seed-masterplay-categories.ts
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { categories } from "../src/db/schema";
import type { CategoryInput } from "../src/lib/validators/category-validator";

const PLATFORMS = [
  "PS5",
  "PS4",
  "Xbox Series X|S",
  "Xbox One",
  "Nintendo Switch 2",
  "Nintendo Switch",
  "PC",
  "Multiplataforma",
];

const COLORS = [
  "Negro",
  "Blanco",
  "Gris",
  "Azul",
  "Rojo",
  "Verde",
  "Morado",
  "Rosado",
  "Amarillo",
  "Multicolor",
];

const CATEGORIES: CategoryInput[] = [
  {
    name: "Videojuegos",
    description: "Juegos físicos (disco o cartucho).",
    template: [
      { key: "plataforma", label: "Plataforma", type: "select", options: PLATFORMS },
      { key: "edicion", label: "Edición", type: "select", options: ["Estándar", "Deluxe", "Coleccionista", "GOTY", "Otra"] },
      { key: "region", label: "Región", type: "select", options: ["Americana (NTSC-U)", "Europea (PAL)", "Japonesa", "Libre"] },
      { key: "idioma", label: "Idioma", type: "text" },
    ],
  },
  {
    name: "Consolas",
    description: "Consolas de mesa y portátiles (con serial).",
    template: [
      { key: "plataforma", label: "Plataforma", type: "select", options: PLATFORMS.filter((p) => p !== "PC" && p !== "Multiplataforma") },
      { key: "modelo", label: "Modelo / versión", type: "text" },
      { key: "almacenamiento", label: "Almacenamiento", type: "text" },
      { key: "color", label: "Color", type: "select", options: COLORS },
      { key: "edicion", label: "Edición / bundle", type: "text" },
    ],
  },
  {
    name: "Controles y accesorios gaming",
    description: "Controles, cargadores de control, headsets, volantes, bases.",
    template: [
      { key: "plataforma", label: "Plataforma", type: "select", options: PLATFORMS },
      { key: "tipo", label: "Tipo", type: "select", options: ["Control", "Headset", "Cargador / base", "Volante", "Cámara / VR", "Estuche", "Otro"] },
      { key: "marca", label: "Marca", type: "text" },
      { key: "color", label: "Color", type: "select", options: COLORS },
    ],
  },
  {
    name: "Accesorios electrónicos",
    description: "Cables, cargadores, audífonos, memorias, fundas.",
    template: [
      { key: "tipo", label: "Tipo", type: "select", options: ["Cable", "Cargador", "Audífonos", "Parlante", "Memoria / almacenamiento", "Funda / protector", "Otro"] },
      { key: "marca", label: "Marca", type: "text" },
      { key: "color", label: "Color", type: "select", options: COLORS },
      { key: "compatibilidad", label: "Compatibilidad", type: "text" },
      { key: "conector", label: "Conector", type: "select", options: ["USB-C", "Lightning", "Micro USB", "USB-A", "HDMI", "Jack 3.5mm", "Inalámbrico", "N/A"] },
    ],
  },
  {
    name: "Juguetes y coleccionables",
    description: "Figuras, Funko, peluches, cartas, réplicas.",
    template: [
      { key: "marca", label: "Marca", type: "text" },
      { key: "franquicia", label: "Franquicia", type: "text" },
      { key: "linea", label: "Línea / serie", type: "text" },
      { key: "edad", label: "Edad recomendada", type: "text" },
      { key: "material", label: "Material", type: "select", options: ["Vinilo", "Plástico", "Peluche", "Cartón / papel", "Metal", "Resina", "Otro"] },
    ],
  },
];

async function main() {
  for (const category of CATEGORIES) {
    const [existing] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.name, category.name))
      .limit(1);

    if (existing) {
      await db
        .update(categories)
        .set({ description: category.description, template: category.template })
        .where(eq(categories.id, existing.id));
      console.log(`↻ ${category.name}`);
    } else {
      await db.insert(categories).values(category);
      console.log(`＋ ${category.name}`);
    }
  }
  console.log("✅ Categorías listas.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌", error);
    process.exit(1);
  });
