/**
 * transport.ts — Transporter singleton de nodemailer (SMTP Gmail).
 * Lazy init: solo se crea al primer envío, con validación de variables.
 */

import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name} para envío de correo.`);
  }
  return value;
}

export function getTransporter(): Transporter {
  if (transporter) return transporter;

  const host = requiredEnv("SMTP_HOST");
  const port = Number(process.env.SMTP_PORT ?? "465");
  const user = requiredEnv("SMTP_USER");
  const pass = requiredEnv("SMTP_PASS");

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return transporter;
}
