"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  createCreditor,
  getCreditors,
  getCreditorDetail,
  addLoan,
  registerCreditorPayment,
  recordAccrual,
  toggleCreditorStatus,
} from "@/services/creditor-service";
import {
  createCreditorSchema,
  addLoanSchema,
  registerCreditorPaymentSchema,
  recordAccrualSchema,
} from "@/lib/validators/creditor-validator";

const REVALIDATE_PATHS = ["/acreedores", "/cash", "/dashboard"];
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

export async function getCreditorsAction() {
  try {
    const data = await getCreditors();
    return { success: true, data };
  } catch (error) {
    console.error("Error fetching creditors:", error);
    return { success: false, error: "Error al cargar los acreedores" };
  }
}

export async function getCreditorDetailAction(creditorId: string) {
  try {
    const data = await getCreditorDetail(creditorId);
    return { success: true, data };
  } catch (error) {
    console.error("Error fetching creditor detail:", error);
    return { success: false, error: "Error al cargar el detalle del acreedor" };
  }
}

export async function createCreditorAction(raw: unknown) {
  try {
    const data = createCreditorSchema.parse(raw);
    const userId = await getCurrentUserId();
    const creditor = await createCreditor(data, userId);
    revalidateAll();
    return { success: true, data: creditor };
  } catch (error: unknown) {
    console.error("Error creating creditor:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al crear el acreedor",
    };
  }
}

export async function addLoanAction(raw: unknown) {
  try {
    const data = addLoanSchema.parse(raw);
    const userId = await getCurrentUserId();
    const result = await addLoan(data, userId);
    if (result.duplicate) {
      return { success: true, duplicate: true, data: result };
    }
    revalidateAll();
    return { success: true, duplicate: false, data: result };
  } catch (error: unknown) {
    console.error("Error adding loan:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al registrar el préstamo",
    };
  }
}

export async function registerCreditorPaymentAction(raw: unknown) {
  try {
    const data = registerCreditorPaymentSchema.parse(raw);
    const userId = await getCurrentUserId();
    const result = await registerCreditorPayment(data, userId);
    if (result.duplicate) {
      return { success: true, duplicate: true, data: result };
    }
    revalidateAll();
    return { success: true, duplicate: false, data: result };
  } catch (error: unknown) {
    console.error("Error registering payment:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al registrar el pago",
    };
  }
}

export async function recordAccrualAction(raw: unknown) {
  try {
    const data = recordAccrualSchema.parse(raw);
    const userId = await getCurrentUserId();
    const result = await recordAccrual(data, userId);
    if (result.duplicate) {
      return { success: true, duplicate: true, data: result };
    }
    revalidateAll();
    return { success: true, duplicate: false, data: result };
  } catch (error: unknown) {
    console.error("Error recording accrual:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al registrar el devengamiento",
    };
  }
}

export async function toggleCreditorStatusAction(creditorId: string) {
  try {
    const userId = await getCurrentUserId();
    const updated = await toggleCreditorStatus(creditorId, userId);
    revalidateAll();
    return { success: true, data: updated };
  } catch (error: unknown) {
    console.error("Error toggling creditor status:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al actualizar el estado del acreedor",
    };
  }
}
