/**
 * Consulta de UPC/EAN en UPCitemdb (plan trial: gratis, ~100 consultas/día,
 * sin API key). Sirve para precargar la ficha de un producto desconocido.
 * Cualquier fallo (sin datos, límite, red) devuelve null: el formulario
 * simplemente queda vacío.
 */
import { isUpcCandidate } from "@/lib/stock-count";

export interface UpcProductData {
  name: string;
  brand: string | null;
  description: string | null;
  color: string | null;
  model: string | null;
  category: string | null;
  imageUrl: string | null;
}

interface UpcItemDbItem {
  title?: string;
  brand?: string;
  description?: string;
  color?: string;
  model?: string;
  category?: string;
  images?: string[];
}

interface UpcItemDbResponse {
  code?: string;
  items?: UpcItemDbItem[];
}

const clean = (value: string | undefined): string | null => {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  return trimmed ? trimmed : null;
};

/** Mapea la respuesta de UPCitemdb; null si no trae un producto con título. */
export const mapUpcItemDbResponse = (
  body: UpcItemDbResponse,
): UpcProductData | null => {
  const item = body.items?.find((candidate) => clean(candidate.title));
  if (!item) return null;

  return {
    name: clean(item.title)!,
    brand: clean(item.brand),
    description: clean(item.description),
    color: clean(item.color),
    model: clean(item.model),
    category: clean(item.category),
    imageUrl: item.images?.find((url) => url.startsWith("https://")) ?? null,
  };
};

const UPC_ENDPOINT = "https://api.upcitemdb.com/prod/trial/lookup";
const TIMEOUT_MS = 4000;

export const lookupUpc = async (code: string): Promise<UpcProductData | null> => {
  if (!isUpcCandidate(code)) return null;

  try {
    const res = await fetch(`${UPC_ENDPOINT}?upc=${encodeURIComponent(code)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Un mismo código devuelve siempre lo mismo: se cachea un día.
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    return mapUpcItemDbResponse((await res.json()) as UpcItemDbResponse);
  } catch {
    return null;
  }
};
