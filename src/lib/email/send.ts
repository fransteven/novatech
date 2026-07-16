/**
 * send.ts — Envío de correo. No lanza: el llamador decide qué hacer con el fallo.
 */

import { getTransporter } from "./transport";

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
}

export interface SendEmailResult {
  ok: boolean;
  error?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  try {
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    if (!from) {
      return { ok: false, error: "Falta SMTP_FROM o SMTP_USER en el entorno." };
    }

    await getTransporter().sendMail({
      from,
      to: Array.isArray(input.to) ? input.to.join(", ") : input.to,
      subject: input.subject,
      html: input.html,
    });

    return { ok: true };
  } catch (error) {
    const err = error as Error;
    return { ok: false, error: err.message || "Error desconocido al enviar el correo." };
  }
}
