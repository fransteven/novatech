/**
 * Métricas de condición de la unidad física (`product_items.condition_details`).
 *
 * No toda métrica aplica a todo el catálogo: la salud de batería describe un
 * iPhone o una laptop, pero no una PlayStation ni un cable. Este registro dice
 * qué campos pedir según la categoría del producto, para que el formulario de
 * compra no muestre atributos que no significan nada para esa mercancía.
 *
 * La condición (nuevo / usado / reacondicionado), su garantía y las notas de
 * condición sí son transversales: viven fuera de este registro.
 */

/** Claves aceptadas por `conditionDetailsSchema` del validador de compras. */
export type ConditionAttributeKey = "batteryHealth";

export interface ConditionAttributeDef {
  key: ConditionAttributeKey;
  label: string;
  placeholder: string;
  min: number;
  max: number;
}

const BATTERY_HEALTH: ConditionAttributeDef = {
  key: "batteryHealth",
  label: "Salud de batería (%)",
  placeholder: "Ej. 95",
  min: 1,
  max: 100,
};

/**
 * Pistas sobre el nombre de la categoría en vez de una lista cerrada de IDs:
 * si mañana se crea "Celulares" o "Parlantes", la batería aparece sola.
 */
const BATTERY_CATEGORY_HINTS = [
  "smartphone",
  "celular",
  "telefono",
  "movil",
  "tablet",
  "ipad",
  "laptop",
  "portatil",
  "computador",
  "smartwatch",
  "reloj",
  "audifono",
  "airpod",
  "auricular",
  "parlante",
  "bocina",
];

/** minúsculas y sin tildes: "Audífonos" -> "audifonos". */
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

/**
 * Atributos de condición que aplican a un producto de esta categoría.
 * Sin categoría (o una que no calza con ninguna pista) no se pide nada extra.
 */
export const getConditionAttributes = (
  categoryName?: string | null,
): ConditionAttributeDef[] => {
  if (!categoryName) return [];
  const name = normalize(categoryName);
  const attributes: ConditionAttributeDef[] = [];

  if (BATTERY_CATEGORY_HINTS.some((hint) => name.includes(hint))) {
    attributes.push(BATTERY_HEALTH);
  }

  return attributes;
};

/**
 * Deja en `conditionDetails` solo las métricas válidas para la categoría.
 * Evita mandar al servidor un dato que quedó de un producto elegido antes.
 */
export const pickConditionDetails = (
  details: Partial<Record<ConditionAttributeKey, unknown>> | null | undefined,
  categoryName?: string | null,
): Record<string, unknown> | null => {
  if (!details) return null;

  const allowed = getConditionAttributes(categoryName);
  const result: Record<string, unknown> = {};

  for (const attribute of allowed) {
    const value = details[attribute.key];
    if (value !== undefined && value !== null && value !== "") {
      result[attribute.key] = value;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
};
