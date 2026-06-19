"use server";

import { revalidatePath } from "next/cache";
import * as shareholdersService from "@/services/shareholders-service";
import {
  createDistributionSchema,
  addContributionSchema,
} from "@/lib/validators/shareholder-validator";

export async function getShareholdersAction() {
  try {
    const data = await shareholdersService.getShareholders();
    return { success: true, data };
  } catch (error) {
    console.error("Error fetching shareholders:", error);
    return { success: false, error: "Failed to fetch shareholders" };
  }
}

export async function getDistributionsAction() {
  try {
    const data = await shareholdersService.getDistributions();
    return { success: true, data };
  } catch (error) {
    console.error("Error fetching distributions:", error);
    return { success: false, error: "Failed to fetch distributions" };
  }
}

export async function createDistributionAction(input: unknown) {
  const result = createDistributionSchema.safeParse(input);
  if (!result.success) {
    return { success: false, error: result.error.issues[0].message };
  }

  try {
    const distribution = await shareholdersService.createDistribution(result.data);
    revalidatePath("/accionistas");
    revalidatePath("/profits");
    return { success: true, data: distribution };
  } catch (error) {
    console.error("Error creating distribution:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create distribution",
    };
  }
}

export async function addContributionAction(input: unknown) {
  const result = addContributionSchema.safeParse(input);
  if (!result.success) {
    return { success: false, error: result.error.issues[0].message };
  }

  try {
    const data = await shareholdersService.addContribution(result.data);
    revalidatePath("/accionistas");
    return { success: true, data };
  } catch (error) {
    console.error("Error adding contribution:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al registrar aporte",
    };
  }
}

export async function markDistributionItemPaidAction(
  itemId: string,
  cashMovementId?: string,
) {
  try {
    const data = await shareholdersService.markDistributionItemPaid(itemId, {
      cashMovementId,
    });
    revalidatePath("/accionistas");
    return { success: true, data };
  } catch (error) {
    console.error("Error marking item paid:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update item",
    };
  }
}
