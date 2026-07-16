"use server";

import { requireAdmin } from "@/lib/auth-guard";
import { sendDailyDigest } from "@/services/collections-digest-service";

/**
 * Disparo manual del digest de cobros (botón "Enviar recordatorio ahora").
 * Fuerza el envío aunque ya exista uno hoy — evita depender del cron.
 */
export async function sendDigestNowAction() {
  try {
    await requireAdmin();

    const result = await sendDailyDigest(new Date(), { force: true });

    if (result.status === "failed") {
      return { success: false, error: result.error || "Error al enviar el digest." };
    }
    if (result.status === "empty") {
      return { success: true, itemCount: 0, message: "No hay cobros pendientes hoy." };
    }
    return { success: true, itemCount: result.itemCount };
  } catch (error) {
    console.error("Error sending collections digest:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al enviar el recordatorio.",
    };
  }
}
