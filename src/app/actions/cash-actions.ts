"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import * as cashService from "@/services/cash-service";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function getCashAccountsAction() {
  try {
    const accounts = await cashService.getCashAccounts();
    return { success: true, data: accounts };
  } catch (error) {
    console.error("Error fetching cash accounts:", error);
    return { success: false, error: "Failed to fetch cash accounts" };
  }
}

export async function createCashAccountAction(data: unknown) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const schema = z.object({
    name: z.string().min(1, "Nombre requerido"),
    type: z.enum(["cash", "bank", "wallet", "card_processor"]),
    currency: z.string().optional(),
    openingBalance: z.coerce.number().min(0).optional(),
  });

  const result = schema.safeParse(data);

  if (!result.success) {
    return { success: false, error: result.error.issues[0].message };
  }

  try {
    await cashService.createCashAccount(result.data);
    revalidatePath("/cash");
    return { success: true };
  } catch (error) {
    console.error("Error creating cash account:", error);
    return { success: false, error: "Failed to create cash account" };
  }
}

export async function getCashAccountBalanceAction(accountId: string) {
  if (!accountId || typeof accountId !== "string") {
    return { success: false, error: "Invalid account ID" };
  }

  try {
    const balance = await cashService.getCashAccountBalance(accountId);
    return { success: true, data: balance };
  } catch (error) {
    console.error("Error fetching cash account balance:", error);
    return { success: false, error: "Failed to fetch account balance" };
  }
}

export async function createCashTransferAction(data: unknown) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const schema = z.object({
    fromAccountId: z.string().uuid(),
    toAccountId: z.string().uuid(),
    amount: z.coerce.number().positive(),
    feeAmount: z.coerce.number().min(0).optional(),
    notes: z.string().optional(),
  });

  const result = schema.safeParse(data);

  if (!result.success) {
    return { success: false, error: result.error.issues[0].message };
  }

  try {
    await cashService.createCashTransfer({ ...result.data, createdBy: session.user.id });
    revalidatePath("/cash");
    return { success: true };
  } catch (error) {
    console.error("Error creating cash transfer:", error);
    return { success: false, error: "Failed to create cash transfer" };
  }
}

export async function createCashReconciliationAction(data: unknown) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const schema = z.object({
    accountId: z.string().uuid(),
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
    countedBalance: z.coerce.number(),
    notes: z.string().optional(),
  });

  const result = schema.safeParse(data);

  if (!result.success) {
    return { success: false, error: result.error.issues[0].message };
  }

  try {
    await cashService.createCashReconciliation({ ...result.data, createdBy: session.user.id });
    revalidatePath("/cash");
    return { success: true };
  } catch (error) {
    console.error("Error creating cash reconciliation:", error);
    return { success: false, error: "Failed to create cash reconciliation" };
  }
}

export async function getCashMovementsAction(accountId: string, limit?: number) {
  try {
    const movements = await cashService.getCashMovements(accountId, limit);
    return { success: true, data: movements };
  } catch (error) {
    console.error("Error fetching cash movements:", error);
    return { success: false, error: "Failed to fetch cash movements" };
  }
}

export async function getCashAccountsWithBalanceAction() {
  try {
    const result = await cashService.getCashAccountsWithBalance();
    return { success: true, data: result };
  } catch (error) {
    console.error("Error fetching accounts with balance:", error);
    return { success: false, error: "Failed to fetch accounts" };
  }
}

export async function getCashFlowSummaryAction(
  periodStart: string,
  periodEnd: string,
) {
  try {
    const summary = await cashService.getCashFlowSummary(
      new Date(periodStart),
      new Date(periodEnd),
    );
    return { success: true, data: summary };
  } catch (error) {
    console.error("Error fetching cash flow summary:", error);
    return { success: false, error: "Failed to fetch summary" };
  }
}

export async function createCashMovementAction(data: unknown) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const schema = z.object({
    accountId: z.string().uuid("ID de cuenta inválido"),
    direction: z.enum(["in", "out"]),
    amount: z.coerce.number().positive("El monto debe ser positivo"),
    sourceType: z.enum(["adjustment", "opening_balance", "shareholder_distribution"]),
    paymentMethod: z
      .enum(["cash", "transfer", "card", "wallet"])
      .default("cash"),
    referenceCode: z.string().optional(),
    notes: z.string().optional(),
  });

  const result = schema.safeParse(data);
  if (!result.success) {
    return { success: false, error: result.error.issues[0].message };
  }

  try {
    await cashService.createCashMovement({
      ...result.data,
      createdBy: session.user.id,
    });
    revalidatePath("/cash");
    return { success: true };
  } catch (error) {
    console.error("Error creating cash movement:", error);
    return { success: false, error: "Failed to create movement" };
  }
}
