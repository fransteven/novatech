"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  createLayaway,
  getLayaways,
  getLayawayDetails,
  addLayawayPayment,
  registerCreditPayment,
  cancelLayaway,
} from "@/services/layaway-service";
import {
  createLayawaySchema,
  addLayawayPaymentSchema,
  registerCreditPaymentSchema,
} from "@/lib/validators/layaway-validator";

const REVALIDATE_PATHS = ["/layaways", "/inventory", "/cash", "/dashboard"];
const revalidateAll = () => REVALIDATE_PATHS.forEach((p) => revalidatePath(p));

export async function getLayawaysAction() {
  try {
    const data = await getLayaways();
    return { success: true, data };
  } catch (error) {
    console.error("Error fetching layaways:", error);
    return { success: false, error: "Error al cargar los apartados" };
  }
}

export async function createLayawayAction(data: unknown) {
  const validation = createLayawaySchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message };
  }

  try {
    const layaway = await createLayaway(validation.data);
    revalidateAll();
    return { success: true, data: layaway };
  } catch (error) {
    console.error("Error creating layaway:", error);
    const err = error as Error;
    return { success: false, error: err.message || "Error al procesar el apartado." };
  }
}

export async function getLayawayDetailsAction(layawayId: string) {
  try {
    const data = await getLayawayDetails(layawayId);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: "Error al cargar los detalles." };
  }
}

export async function addLayawayPaymentAction(data: unknown) {
  const validation = addLayawayPaymentSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message };
  }

  try {
    await addLayawayPayment(validation.data);
    revalidateAll();
    return { success: true };
  } catch (error) {
    const err = error as Error;
    return { success: false, error: err.message || "Error al procesar el pago." };
  }
}

export async function registerCreditPaymentAction(data: unknown) {
  const validation = registerCreditPaymentSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message };
  }

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;

    const result = await registerCreditPayment({ ...validation.data, userId });
    revalidateAll();
    return { success: true, duplicate: result.duplicate };
  } catch (error) {
    const err = error as Error;
    return { success: false, error: err.message || "Error al procesar el pago." };
  }
}

export async function cancelLayawayAction(layawayId: string) {
  try {
    await cancelLayaway(layawayId);
    revalidateAll();
    return { success: true };
  } catch (error) {
    const err = error as Error;
    return { success: false, error: err.message || "Error al cancelar el apartado." };
  }
}
