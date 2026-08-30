"use server";

import { revalidatePath } from "next/cache";
import { searchProduct, processSale } from "@/services/pos-service";
import {
  searchProductSchema,
  processSaleSchema,
} from "@/lib/validators/pos-validator";
import { getSessionUser } from "@/lib/auth-guard";

export async function searchProductAction(query: string) {
  const result = searchProductSchema.safeParse({ barcode: query });

  if (!result.success) {
    return {
      success: false,
      error: result.error.issues[0].message,
    };
  }

  try {
    const product = await searchProduct(result.data.barcode);

    if (!product) {
      return {
        success: false,
        error: "Producto no encontrado",
      };
    }

    return {
      success: true,
      data: product,
    };
  } catch (error) {
    console.error("Error searching product:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al buscar producto",
    };
  }
}

export async function processSaleAction(data: unknown) {
  const result = processSaleSchema.safeParse(data);

  if (!result.success) {
    return {
      success: false,
      error: result.error.issues[0].message,
    };
  }

  try {
    // El vendedor sale de la sesión, nunca del payload (zero-trust).
    const user = await getSessionUser();
    if (!user) {
      return { success: false, error: "No autorizado" };
    }

    const saleResult = await processSale({
      items: result.data.items,
      totalAmount: result.data.totalAmount,
      customerId: result.data.customerId,
      payments: result.data.payments,
      userId: user.id,
    });

    revalidatePath("/pos");
    revalidatePath("/inventory");
    revalidatePath("/garantias");

    return {
      success: true,
      message: "Venta procesada exitosamente",
      saleId: saleResult.saleId,
    };
  } catch (error) {
    console.error("Error processing sale:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al procesar la venta",
    };
  }
}
