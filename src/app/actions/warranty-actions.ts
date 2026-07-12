"use server";

import { revalidatePath } from "next/cache";
import * as warrantyService from "@/services/warranty-service";
import {
  warrantyLookupSchema,
  createClaimSchema,
  updateClaimStatusSchema,
  adjustWarrantySchema,
} from "@/lib/validators/warranty-validator";
import { getSessionUser, requireAdmin } from "@/lib/auth-guard";
import { recordAudit } from "@/services/audit-service";

export async function lookupWarrantyAction(data: unknown) {
  const result = warrantyLookupSchema.safeParse(data);
  if (!result.success) {
    return { success: false, error: result.error.issues[0].message };
  }

  try {
    const warranty = await warrantyService.getWarrantyBySerial(
      result.data.serial,
    );
    return { success: true, data: warranty };
  } catch (error) {
    console.error("Error looking up warranty:", error);
    return { success: false, error: "Error al consultar la garantía" };
  }
}

export async function registerClaimAction(data: unknown) {
  const result = createClaimSchema.safeParse(data);
  if (!result.success) {
    return { success: false, error: result.error.issues[0].message };
  }

  try {
    const user = await getSessionUser();
    if (!user) {
      return { success: false, error: "No autorizado" };
    }

    const { claim, withinWarranty } = await warrantyService.createClaim(
      result.data,
      user,
    );

    revalidatePath("/garantias");
    return { success: true, data: claim, withinWarranty };
  } catch (error) {
    console.error("Error registering warranty claim:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al registrar el reclamo de garantía",
    };
  }
}

export async function updateClaimStatusAction(data: unknown) {
  const result = updateClaimStatusSchema.safeParse(data);
  if (!result.success) {
    return { success: false, error: result.error.issues[0].message };
  }

  try {
    const user = await getSessionUser();
    if (!user) {
      return { success: false, error: "No autorizado" };
    }

    const updated = await warrantyService.updateClaimStatus(
      result.data,
      user.id,
    );

    revalidatePath("/garantias");
    return { success: true, data: updated };
  } catch (error) {
    console.error("Error updating warranty claim:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al actualizar el reclamo",
    };
  }
}

export async function adjustWarrantyAction(data: unknown) {
  const result = adjustWarrantySchema.safeParse(data);
  if (!result.success) {
    return { success: false, error: result.error.issues[0].message };
  }

  try {
    const admin = await requireAdmin();
    const { warranty, previous } = await warrantyService.adjustWarranty(
      result.data,
      admin.id,
    );

    await recordAudit({
      userId: admin.id,
      userName: admin.name,
      action: previous ? "warranty.adjust" : "warranty.create",
      entityType: "warranty",
      entityId: warranty.id,
      changes: previous
        ? {
            startDate: { old: previous.startDate, new: warranty.startDate },
            warrantyMonths: {
              old: previous.warrantyMonths,
              new: warranty.warrantyMonths,
            },
          }
        : {
            startDate: { old: null, new: warranty.startDate },
            warrantyMonths: { old: null, new: warranty.warrantyMonths },
          },
    });

    revalidatePath("/garantias");
    return { success: true, data: warranty };
  } catch (error) {
    console.error("Error adjusting warranty:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al ajustar la garantía",
    };
  }
}

export async function getRecentClaimsAction() {
  try {
    const claims = await warrantyService.getRecentClaims();
    return { success: true, data: claims };
  } catch (error) {
    console.error("Error fetching warranty claims:", error);
    return { success: false, error: "Error al cargar los reclamos" };
  }
}
