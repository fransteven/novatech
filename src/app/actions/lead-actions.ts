"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  createLead,
  getLeads,
  getLeadById,
  updateLeadStage,
  addLeadActivity,
  previewAmortization,
  getMarketingSuggestion,
  convertLeadToLayaway,
} from "@/services/lead-service";
import {
  createLeadSchema,
  updateLeadStageSchema,
  addLeadActivitySchema,
  convertLeadToLayawaySchema,
} from "@/lib/validators/lead-validator";

const REVALIDATE_PATHS = ["/leads", "/layaways", "/dashboard"];
const revalidateAll = () => REVALIDATE_PATHS.forEach((p) => revalidatePath(p));

async function getCurrentUserId(): Promise<string | undefined> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    return session?.user?.id;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------

export async function getLeadsAction() {
  try {
    const data = await getLeads();
    return { success: true, data };
  } catch (error) {
    console.error("Error fetching leads:", error);
    return { success: false, error: "Error al cargar los leads" };
  }
}

export async function getLeadByIdAction(id: string) {
  try {
    const data = await getLeadById(id);
    return { success: true, data };
  } catch (error) {
    console.error("Error fetching lead:", error);
    return { success: false, error: "Error al cargar el lead" };
  }
}

export async function createLeadAction(raw: unknown) {
  try {
    const data = createLeadSchema.parse(raw);
    const userId = await getCurrentUserId();
    const lead = await createLead(data, userId);
    revalidateAll();
    return { success: true, data: lead };
  } catch (error: unknown) {
    console.error("Error creating lead:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al crear el lead",
    };
  }
}

export async function updateLeadStageAction(raw: unknown) {
  try {
    const data = updateLeadStageSchema.parse(raw);
    const userId = await getCurrentUserId();
    await updateLeadStage(data, userId);
    revalidateAll();
    return { success: true };
  } catch (error: unknown) {
    console.error("Error updating lead stage:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al actualizar la etapa",
    };
  }
}

export async function addLeadActivityAction(raw: unknown) {
  try {
    const data = addLeadActivitySchema.parse(raw);
    const userId = await getCurrentUserId();
    const activity = await addLeadActivity(data, userId);
    revalidatePath("/leads");
    return { success: true, data: activity };
  } catch (error: unknown) {
    console.error("Error adding lead activity:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al registrar actividad",
    };
  }
}

export async function getAmortizationPreviewAction(leadId: string) {
  try {
    const schedule = await previewAmortization(leadId);
    return { success: true, data: schedule };
  } catch (error: unknown) {
    console.error("Error previewing amortization:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al calcular la amortización",
    };
  }
}

export async function getMarketingSuggestionAction(leadId: string) {
  try {
    const userId = await getCurrentUserId();
    const suggestion = await getMarketingSuggestion(leadId, userId);
    revalidatePath("/leads");
    return { success: true, data: suggestion };
  } catch (error: unknown) {
    console.error("Error getting marketing suggestion:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al generar la sugerencia",
    };
  }
}

export async function convertLeadAction(raw: unknown) {
  try {
    const data = convertLeadToLayawaySchema.parse(raw);
    const userId = await getCurrentUserId();
    const layaway = await convertLeadToLayaway(data, userId);
    revalidateAll();
    return { success: true, data: layaway };
  } catch (error: unknown) {
    console.error("Error converting lead:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al convertir el lead",
    };
  }
}
