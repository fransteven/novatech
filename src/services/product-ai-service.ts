import { z } from "zod";
import { getLLMProvider, type LLMImage } from "@/lib/llm";
import type { CategoryAttribute } from "@/lib/validators/category-validator";

/**
 * Ficha de producto sugerida por IA a partir de fotos (y, si existe, de lo que
 * devolvió la consulta de UPC). El usuario siempre revisa antes de guardar.
 */

export interface CategoryForAi {
  id: string;
  name: string;
  template: CategoryAttribute[];
}

export interface ProductSuggestion {
  categoryId: string | null;
  name: string;
  description: string;
  attributes: Record<string, string | number>;
}

const rawSuggestionSchema = z.object({
  categoryId: z.string().nullable().optional(),
  name: z.string().min(1),
  description: z.string().optional().default(""),
  attributes: z.record(z.string(), z.unknown()).optional().default({}),
});

/** Extrae el primer objeto JSON del texto (tolera ```json …``` alrededor). */
const extractJson = (text: string): unknown => {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("La IA no devolvió JSON.");
  return JSON.parse(text.slice(start, end + 1));
};

/**
 * Valida la respuesta de la IA contra las categorías reales: descarta una
 * categoría inventada, atributos que no están en el template, opciones de
 * select que no existen y números inválidos.
 */
export const parseProductSuggestion = (
  text: string,
  categories: CategoryForAi[],
): ProductSuggestion => {
  const raw = rawSuggestionSchema.parse(extractJson(text));
  const category = categories.find((c) => c.id === raw.categoryId) ?? null;

  const attributes: Record<string, string | number> = {};
  for (const field of category?.template ?? []) {
    const value = raw.attributes[field.key];
    if (value === null || value === undefined || value === "") continue;

    if (field.type === "number") {
      const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
      if (Number.isFinite(n)) attributes[field.key] = n;
    } else if (field.type === "select") {
      const option = field.options?.find(
        (o) => o.toLowerCase() === String(value).trim().toLowerCase(),
      );
      if (option) attributes[field.key] = option;
    } else {
      attributes[field.key] = String(value).trim();
    }
  }

  return {
    categoryId: category?.id ?? null,
    name: raw.name.trim(),
    description: raw.description.trim(),
    attributes,
  };
};

const buildPrompt = (
  categories: CategoryForAi[],
  upcHint?: { name?: string; brand?: string; description?: string } | null,
) => {
  const catalog = categories.map((c) => ({
    id: c.id,
    nombre: c.name,
    atributos: c.template.map((f) => ({
      key: f.key,
      etiqueta: f.label,
      tipo: f.type,
      ...(f.options?.length ? { opciones: f.options } : {}),
    })),
  }));

  return [
    "Identifica el producto de las fotos para registrarlo en el inventario de una tienda en Colombia",
    "(videojuegos, consolas, accesorios electrónicos, juguetes y coleccionables).",
    upcHint
      ? `Datos de la base de códigos de barras (pueden estar en inglés): ${JSON.stringify(upcHint)}.`
      : "",
    `Categorías disponibles: ${JSON.stringify(catalog)}.`,
    "Responde SOLO un JSON con esta forma:",
    '{"categoryId": "<id de la categoría que mejor encaje o null>", "name": "<nombre comercial corto en español: marca + producto + variante, ej. \\"Control DualSense PS5 Blanco\\">", "description": "<descripción completa en español, 2 a 4 frases: qué es, características visibles, compatibilidad y qué incluye la caja si se ve>", "attributes": {"<key>": "<valor>"}}',
    "Reglas: usa sólo las keys de la categoría elegida; en atributos tipo select usa exactamente una de las opciones;",
    "no inventes datos que no se vean o no estén en los datos del código; si no sabes un atributo, omítelo.",
  ]
    .filter(Boolean)
    .join("\n");
};

export const suggestProductFromImages = async (input: {
  images: LLMImage[];
  categories: CategoryForAi[];
  upcHint?: { name?: string; brand?: string; description?: string } | null;
}): Promise<ProductSuggestion> => {
  const text = await getLLMProvider().generate({
    system:
      "Eres un catalogador de inventario minucioso. Describes productos con precisión y en español neutro de Colombia.",
    prompt: buildPrompt(input.categories, input.upcHint),
    images: input.images,
    json: true,
    maxTokens: 2048,
  });
  return parseProductSuggestion(text, input.categories);
};
