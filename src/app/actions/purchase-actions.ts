"use server";

import { ZodError } from "zod";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { PurchaseService } from "@/services/purchase-service";
import {
  createPurchaseSchema,
  registerPurchasePaymentSchema,
  purchaseFiltersSchema,
} from "@/lib/validators/purchase-validator";
import { auth } from "@/lib/auth";

/**
 * Traduce cualquier error a un mensaje presentable, sin filtrar detalles de BD.
 * Zod v4 expone las incidencias en `issues` (no en `errors`, que era la API v3).
 */
const toErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? fallback;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

const requireUser = async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    throw new Error("No autorizado");
  }
  return session.user;
};

/** Revalida todo lo que una compra toca: inventario, caja y tableros. */
const revalidatePurchaseSurfaces = () => {
  revalidatePath("/purchases");
  revalidatePath("/inventory");
  revalidatePath("/catalog");
  revalidatePath("/cash");
  revalidatePath("/dashboard");
};

export async function createPurchaseAction(data: unknown) {
  try {
    const user = await requireUser();
    const validatedData = createPurchaseSchema.parse(data);

    const purchase = await PurchaseService.createPurchase({
      ...validatedData,
      userId: user.id,
    });

    revalidatePurchaseSurfaces();

    return { success: true as const, data: purchase };
  } catch (error) {
    console.error("Error creating purchase:", error);
    return {
      success: false as const,
      error: toErrorMessage(error, "Error al registrar la compra"),
    };
  }
}

export async function registerPurchasePaymentAction(data: unknown) {
  try {
    const user = await requireUser();
    const validatedData = registerPurchasePaymentSchema.parse(data);

    const purchase = await PurchaseService.registerPurchasePayment({
      ...validatedData,
      userId: user.id,
    });

    revalidatePurchaseSurfaces();

    return { success: true as const, data: purchase };
  } catch (error) {
    console.error("Error registering purchase payment:", error);
    return {
      success: false as const,
      error: toErrorMessage(error, "Error al registrar el abono"),
    };
  }
}

export async function getPurchasesAction(filters?: unknown) {
  try {
    const parsedFilters = filters
      ? purchaseFiltersSchema.parse(filters)
      : undefined;
    const purchases = await PurchaseService.getPurchases(parsedFilters);
    return { success: true as const, data: purchases };
  } catch (error) {
    console.error("Error fetching purchases:", error);
    return { success: false as const, error: "Error al cargar las compras" };
  }
}

export async function getPurchaseByIdAction(id: string) {
  try {
    const purchase = await PurchaseService.getPurchaseById(id);
    return { success: true as const, data: purchase };
  } catch (error) {
    console.error("Error fetching purchase by id:", error);
    return {
      success: false as const,
      error: "Error al cargar los detalles de la compra",
    };
  }
}

export async function getPurchaseStatsAction() {
  try {
    const stats = await PurchaseService.getPurchaseStats();
    return { success: true as const, data: stats };
  } catch (error) {
    console.error("Error fetching purchase stats:", error);
    return {
      success: false as const,
      error: "Error al cargar las estadísticas de compras",
    };
  }
}
