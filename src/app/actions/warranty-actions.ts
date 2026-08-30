"use server";

import { revalidatePath } from "next/cache";
import * as warrantyService from "@/services/warranty-service";
import {
  warrantySearchSchema,
  warrantyAnchorSchema,
  createClaimSchema,
  updateClaimStatusSchema,
  adjustWarrantySchema,
} from "@/lib/validators/warranty-validator";
import { getSessionUser, requireAdmin } from "@/lib/auth-guard";
import { recordAudit } from "@/services/audit-service";

/**
 * Consulta de garantías. Devuelve datos de contacto de clientes, así que exige
 * sesión — no es un endpoint público.
 */
export async function searchWarrantiesAction(data: unknown) {
  const result = warrantySearchSchema.safeParse(data);
  if (!result.success) {
    return { success: false as const, error: result.error.issues[0].message };
  }

  try {
    const user = await getSessionUser();
    if (!user) {
      return { success: false as const, error: "No autorizado" };
    }

    const found = await warrantyService.searchWarranties(result.data);
    return { success: true as const, data: found };
  } catch (error) {
    console.error("Error searching warranties:", error);
    return { success: false as const, error: "Error al consultar garantías" };
  }
}

export async function getWarrantyDetailAction(data: unknown) {
  const result = warrantyAnchorSchema.safeParse(data);
  if (!result.success) {
    return { success: false as const, error: result.error.issues[0].message };
  }

  try {
    const user = await getSessionUser();
    if (!user) {
      return { success: false as const, error: "No autorizado" };
    }

    const detail = await warrantyService.getWarrantyDetail(result.data);
    if (!detail) {
      return { success: false as const, error: "Entrega no encontrada" };
    }
    return { success: true as const, data: detail };
  } catch (error) {
    console.error("Error loading warranty detail:", error);
    return {
      success: false as const,
      error: "Error al cargar el detalle de la garantía",
    };
  }
}

export async function registerClaimAction(data: unknown) {
  const result = createClaimSchema.safeParse(data);
  if (!result.success) {
    return { success: false as const, error: result.error.issues[0].message };
  }

  try {
    const user = await getSessionUser();
    if (!user) {
      return { success: false as const, error: "No autorizado" };
    }

    const { claim, withinWarranty } = await warrantyService.createClaim(
      result.data,
      user,
    );

    revalidatePath("/garantias");
    return { success: true as const, data: claim, withinWarranty };
  } catch (error) {
    console.error("Error registering warranty claim:", error);
    return {
      success: false as const,
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
    return { success: false as const, error: result.error.issues[0].message };
  }

  try {
    const user = await getSessionUser();
    if (!user) {
      return { success: false as const, error: "No autorizado" };
    }

    const updated = await warrantyService.updateClaimStatus(
      result.data,
      user.id,
    );

    revalidatePath("/garantias");
    return { success: true as const, data: updated };
  } catch (error) {
    console.error("Error updating warranty claim:", error);
    return {
      success: false as const,
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
    return { success: false as const, error: result.error.issues[0].message };
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
    return { success: true as const, data: warranty };
  } catch (error) {
    console.error("Error adjusting warranty:", error);
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Error al ajustar la garantía",
    };
  }
}

export async function getRecentClaimsAction() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return { success: false as const, error: "No autorizado" };
    }

    const claims = await warrantyService.getRecentClaims();
    return { success: true as const, data: claims };
  } catch (error) {
    console.error("Error fetching warranty claims:", error);
    return { success: false as const, error: "Error al cargar los reclamos" };
  }
}
