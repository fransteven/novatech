/**
 * client.ts — Cliente Inngest para tareas programadas (cron) de la app.
 */

import { BRAND } from "@/config/brand";
import { Inngest } from "inngest";

export const inngest = new Inngest({ id: BRAND.slug });
