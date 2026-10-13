"use server";

import { revalidatePath } from "next/cache";
import {
  receiveStock,
  getInventoryItems,
  getInventoryMovements,
  getProductSerials,
  searchInventoryStock,
  updateSerialItem,
} from "@/services/inventory-service";
import {
  addProductBarcodeSchema,
  receiveStockSchema,
  removeProductBarcodeSchema,
  updateSerialItemSchema,
} from "@/lib/validators/inventory-validator";
import {
  addProductBarcodes,
  listProductBarcodes,
  removeProductBarcode,
} from "@/services/product-barcode-service";
import { db } from "@/db";
import { getSessionUser, requireAdmin } from "@/lib/auth-guard";
import { recordAudit } from "@/services/audit-service";

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
      condition: validationResult.data.condition,
      warrantyMonths: validationResult.data.warrantyMonths,
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

export async function updateSerialItemAction(data: unknown) {
  try {
    const admin = await requireAdmin();

    const validationResult = updateSerialItemSchema.safeParse(data);
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.issues[0].message,
      };
    }

    const { productId, changes } = await updateSerialItem(
      validationResult.data,
    );

    if (Object.keys(changes).length > 0) {
      await recordAudit({
        userId: admin.id,
        userName: admin.name,
        action: "product_item.update",
        entityType: "product_item",
        entityId: validationResult.data.itemId,
        changes,
      });
    }

    revalidatePath("/inventory");
    revalidatePath("/dashboard");

    return { success: true, productId };
  } catch (error) {
    console.error("Error updating serial item:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update inventory record",
    };
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

const revalidateBarcodeSurfaces = () => {
  revalidatePath("/inventory");
  revalidatePath("/catalog");
  revalidatePath("/purchases");
};

export async function getProductBarcodesAction(productId: string) {
  try {
    if (!(await getSessionUser())) throw new Error("No autorizado");
    const data = await listProductBarcodes(productId);
    return { success: true as const, data };
  } catch (error) {
    console.error("Error fetching product barcodes:", error);
    return { success: false as const, error: "No se pudieron cargar los códigos" };
  }
}

export async function addProductBarcodeAction(data: unknown) {
  try {
    if (!(await getSessionUser())) throw new Error("No autorizado");

    const parsed = addProductBarcodeSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0].message };
    }

    const inserted = await addProductBarcodes(db, parsed.data.productId, [
      parsed.data.code,
    ]);
    revalidateBarcodeSurfaces();

    return { success: true as const, added: inserted.length > 0 };
  } catch (error) {
    console.error("Error adding product barcode:", error);
    return {
      success: false as const,
      error:
        error instanceof Error ? error.message : "No se pudo agregar el código",
    };
  }
}

export async function removeProductBarcodeAction(data: unknown) {
  try {
    const admin = await requireAdmin();

    const parsed = removeProductBarcodeSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0].message };
    }

    const removed = await removeProductBarcode(parsed.data.id);
    await recordAudit({
      userId: admin.id,
      userName: admin.name,
      action: "product_barcode.delete",
      entityType: "product",
      entityId: removed.productId,
      changes: { code: { old: removed.code, new: null } },
    });
    revalidateBarcodeSurfaces();

    return { success: true as const };
  } catch (error) {
    console.error("Error removing product barcode:", error);
    return {
      success: false as const,
      error:
        error instanceof Error ? error.message : "No se pudo quitar el código",
    };
  }
}
