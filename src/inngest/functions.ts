/**
 * functions.ts — Funciones Inngest: digest diario de cobros.
 */

import { inngest } from "./client";
import { sendDailyDigest } from "@/services/collections-digest-service";

// Cron diario 8:00am hora Colombia (America/Bogota, UTC-5 todo el año).
export const dailyCollectionsDigest = inngest.createFunction(
  {
    id: "daily-collections-digest",
    name: "Digest diario de cobros",
    triggers: { cron: "TZ=America/Bogota 0 8 * * *" },
  },
  async ({ step }) => {
    const result = await step.run("send-digest", () =>
      sendDailyDigest(new Date()),
    );
    return result;
  },
);

// Disparo manual desde el botón "Enviar recordatorio ahora".
export const sendDigestNow = inngest.createFunction(
  {
    id: "send-digest-now",
    name: "Enviar digest de cobros ahora",
    triggers: { event: "app/digest.send" },
  },
  async ({ step }) => {
    const result = await step.run("send-digest", () =>
      sendDailyDigest(new Date(), { force: true }),
    );
    return result;
  },
);
