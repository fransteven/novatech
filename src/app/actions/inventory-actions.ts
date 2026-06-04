"use server";

import { revalidatePath } from "next/cache";
import {
  receiveStock,
  getInventoryItems,
  getInventoryMovements,
  getProductSerials,
  searchInventoryStock,
} from "@/services/inventory-service";
import { receiveStockSchema } from "@/lib/validators/inventory-validator";

type ReceiveStockResult =
  | { success: false; error: string }
  | {
      success: true;
      message: string;
      type: "serialized";
      items: { id: string; serialNumber: string | null }[];
    }
  | {
      success: true;
      message: string;
      type: "generic";
      product: { sku: string | null; name: string };
      quantity: number;
    };

export async function receiveStockAction(
  data: unknown,
): Promise<ReceiveStockResult> {
  const validationResult = receiveStockSchema.safeParse(data);

  if (!validationResult.success) {
    return {
      success: false,
      error: validationResult.error.issues[0].message,
    };
  }

  try {
    const result = await receiveStock({
      productId: validationResult.data.productId,
      quantity: validationResult.data.quantity,
      unitCost: validationResult.data.unitCost,
      serials: validationResult.data.serials,
      batteryHealth: validationResult.data.batteryHealth,
      notes: validationResult.data.notes,
    });

    revalidatePath("/inventory");
    revalidatePath("/dashboard");

    // The result from receiveStock already contains type, items/product/quantity
    // We just need to cast it or ensure receiveStock returns compatible types
    return {
      message: "Stock received successfully",
      ...result,
    } as ReceiveStockResult;
  } catch (error) {
    console.error("Error receiving stock:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to receive stock",
    };
  }
}

export async function getInventoryItemsAction() {
  try {
    const items = await getInventoryItems();
    return { success: true, data: items };
  } catch (error) {
    console.error("Error fetching inventory items:", error);
    return { success: false, error: "Failed to fetch inventory items" };
  }
}

export async function getInventoryMovementsAction() {
  try {
    const movements = await getInventoryMovements();
    return { success: true, data: movements };
  } catch (error) {
    console.error("Error fetching inventory movements:", error);
    return { success: false, error: "Failed to fetch inventory movements" };
  }
}

export async function getProductSerialsAction(productId: string) {
  try {
    const serials = await getProductSerials(productId);
    return { success: true, data: serials };
  } catch (error) {
    console.error("Error fetching product serials:", error);
    return { success: false, error: "Failed to fetch product serials" };
  }
}

export async function searchInventoryAction(query: string) {
  try {
    const data = await searchInventoryStock(query);
    return { success: true, data };
  } catch (error) {
    console.error("Error searching inventory:", error);
    return { success: false, error: "Failed to search inventory" };
  }
}
