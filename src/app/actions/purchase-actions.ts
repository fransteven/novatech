"use server";

import { PurchaseService } from "@/services/purchase-service";
import { createPurchaseSchema } from "@/lib/validators/purchase-validator";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function createPurchaseAction(data: unknown) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "No autorizado" };
    }

    const validatedData = createPurchaseSchema.parse(data);

    const purchase = await PurchaseService.createPurchase({
      ...validatedData,
      userId: session.user.id,
    });

    revalidatePath("/purchases");
    revalidatePath("/inventory");
    revalidatePath("/cash");
    revalidatePath("/dashboard");

    return { success: true, data: purchase };
  } catch (error: any) {
    console.error("Error creating purchase:", error);
    if (error.name === "ZodError") {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: error.message || "Error al registrar la compra" };
  }
}

export async function getPurchasesAction() {
  try {
    const purchases = await PurchaseService.getPurchases();
    return { success: true, data: purchases };
  } catch (error: any) {
    console.error("Error fetching purchases:", error);
    return { success: false, error: "Error al cargar las compras" };
  }
}

export async function getPurchaseByIdAction(id: string) {
  try {
    const purchase = await PurchaseService.getPurchaseById(id);
    return { success: true, data: purchase };
  } catch (error: any) {
    console.error("Error fetching purchase by id:", error);
    return { success: false, error: "Error al cargar los detalles de la compra" };
  }
}
