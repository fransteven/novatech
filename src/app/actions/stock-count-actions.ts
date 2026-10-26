"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { getSessionUser, type SessionUser } from "@/lib/auth-guard";
import * as stockCountService from "@/services/stock-count-service";
import { getCategories } from "@/services/category-service";
import { suggestProductFromImages } from "@/services/product-ai-service";
import { lookupUpc } from "@/lib/upc-lookup";
import { normalizeBarcode } from "@/lib/barcodes";
import type { CategoryAttribute } from "@/lib/validators/category-validator";
import {
  addProductToCountSchema,
  addSerialToCountSchema,
  countIdSchema,
  createCountSchema,
  lineIdSchema,
  productIdSchema,
  quickCreateProductSchema,
  removeSerialSchema,
  scanIntoCountSchema,
  suggestFromImageSchema,
  updateCountLineSchema,
} from "@/lib/validators/stock-count-validator";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

/** Mensajes de BD (constraints, SQL) no llegan crudos al cliente. */
const toUserError = (error: unknown, fallback: string): string => {
  if (!(error instanceof Error)) return fallback;
  const pgCode = (error as { code?: string }).code;
  if (pgCode === "23505") return "Ese registro ya existe (código o producto duplicado).";
  if (pgCode) return fallback;
  return error.message || fallback;
};

/** Sesión obligatoria + validación Zod + manejo de errores uniforme. */
const run = async <S extends z.ZodTypeAny, T>(
  schema: S,
  input: unknown,
  fallback: string,
  fn: (data: z.infer<S>, user: SessionUser) => Promise<T>,
  revalidate?: (data: z.infer<S>) => void,
): Promise<ActionResult<T>> => {
  try {
    const user = await getSessionUser();
    if (!user) return { success: false, error: "No autorizado" };

    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const data = await fn(parsed.data, user);
    revalidate?.(parsed.data);
    return { success: true, data };
  } catch (error) {
    console.error(`[stock-count] ${fallback}:`, error);
    return { success: false, error: toUserError(error, fallback) };
  }
};

const revalidateCount = (countId?: string) => {
  revalidatePath("/inventory/count");
  if (countId) revalidatePath(`/inventory/count/${countId}`);
};

export async function createCountAction(input: unknown) {
  return run(createCountSchema, input, "No se pudo crear el conteo", (data, user) =>
    stockCountService.createCount(data.name, user.id),
    () => revalidateCount(),
  );
}

export async function getCountAction(input: unknown) {
  return run(countIdSchema, input, "No se pudo cargar el conteo", async (data) => {
    const count = await stockCountService.getCountWithLines(data.countId);
    if (!count) throw new Error("El conteo no existe.");
    return count;
  });
}

export async function deleteCountAction(input: unknown) {
  return run(countIdSchema, input, "No se pudo borrar el conteo", (data) =>
    stockCountService.deleteDraftCount(data.countId),
    () => revalidateCount(),
  );
}

export async function scanIntoCountAction(input: unknown) {
  return run(scanIntoCountSchema, input, "No se pudo registrar el escaneo", (data) =>
    stockCountService.scanIntoCount(data.countId, data.code, data.condition),
  );
}

export async function addProductToCountAction(input: unknown) {
  return run(addProductToCountSchema, input, "No se pudo agregar el producto", (data) =>
    stockCountService.addProductToCount(data),
  );
}

export async function addSerialToCountAction(input: unknown) {
  return run(addSerialToCountSchema, input, "No se pudo agregar el serial", (data) =>
    stockCountService.addSerialToCount(data),
  );
}

export async function updateCountLineAction(input: unknown) {
  return run(updateCountLineSchema, input, "No se pudo actualizar la línea", (data) =>
    stockCountService.updateCountLine(data),
  );
}

export async function removeCountLineAction(input: unknown) {
  return run(lineIdSchema, input, "No se pudo quitar la línea", (data) =>
    stockCountService.removeCountLine(data.lineId),
  );
}

export async function removeSerialFromLineAction(input: unknown) {
  return run(removeSerialSchema, input, "No se pudo quitar el serial", (data) =>
    stockCountService.removeSerialFromLine(data.lineId, data.serial),
  );
}

export async function quickCreateProductAction(input: unknown) {
  return run(
    quickCreateProductSchema,
    input,
    "No se pudo crear el producto",
    (data) => stockCountService.quickCreateProductInCount(data),
    () => {
      revalidatePath("/catalog");
      revalidatePath("/inventory");
    },
  );
}

export async function assignInternalCodeAction(input: unknown) {
  return run(productIdSchema, input, "No se pudo generar el código", (data) =>
    stockCountService.assignInternalCodeToProduct(data.productId),
  );
}

export async function applyCountAction(input: unknown) {
  return run(
    countIdSchema,
    input,
    "No se pudo aplicar el conteo",
    (data) => stockCountService.applyCount(data.countId),
    (data) => {
      revalidateCount(data.countId);
      revalidatePath("/inventory");
      revalidatePath("/catalog");
      revalidatePath("/pos");
    },
  );
}

/** Datos públicos del código (UPCitemdb). null = sin datos; nunca falla. */
export async function lookupUpcAction(code: string) {
  if (!(await getSessionUser())) return null;
  return lookupUpc(normalizeBarcode(code));
}

export async function suggestProductFromImagesAction(input: unknown) {
  return run(
    suggestFromImageSchema,
    input,
    "La IA no pudo identificar el producto",
    async (data) => {
      const categories = (await getCategories()).map((category) => ({
        id: category.id,
        name: category.name,
        template: (category.template as CategoryAttribute[] | null) ?? [],
      }));
      return suggestProductFromImages({
        images: data.images,
        categories,
        upcHint: data.upcHint ?? null,
      });
    },
  );
}
