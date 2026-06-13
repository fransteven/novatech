/**
 * marketing.ts — Generación de sugerencias de marketing IA para leads.
 * Usa la abstracción getLLMProvider() para soportar Claude, DeepSeek, etc.
 */

import { getLLMProvider } from "@/lib/llm";

export interface LeadMarketingContext {
  prospectName: string;
  prospectPhone: string;
  productDescription: string;
  salePrice: number;
  costPrice: number;
  interestRate: number;
  termMonths: number;
  stage: string;
  daysSinceLastContact: number | null;
  notes?: string | null;
}

const STAGE_LABELS: Record<string, string> = {
  nuevo: "nuevo (sin contacto previo)",
  contactado: "contactado (primer acercamiento realizado)",
  negociando: "en negociación activa",
  ganado: "ganado",
  perdido: "perdido",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);

export function buildMarketingPrompt(ctx: LeadMarketingContext): {
  system: string;
  prompt: string;
} {
  const margin = ctx.salePrice - ctx.costPrice;
  const marginPct = ((margin / ctx.salePrice) * 100).toFixed(1);
  const monthlyPct = (ctx.interestRate * 100).toFixed(1);
  const stageLabel = STAGE_LABELS[ctx.stage] ?? ctx.stage;
  const contactInfo =
    ctx.daysSinceLastContact !== null
      ? `Hace ${ctx.daysSinceLastContact} día(s)`
      : "Sin contacto registrado aún";

  const system =
    "Eres un asesor comercial experto en ventas de tecnología a crédito en Colombia. " +
    "Tu estilo es cercano, honesto y persuasivo. Evita jerga corporativa. " +
    "Responde SIEMPRE en español. Sé conciso y accionable.";

  const prompt = `## Lead: ${ctx.prospectName}
- Producto de interés: ${ctx.productDescription}
- Precio de venta: ${fmt(ctx.salePrice)} | Costo: ${fmt(ctx.costPrice)} | Margen: ${fmt(margin)} (${marginPct}%)
- Crédito: ${monthlyPct}% mensual × ${ctx.termMonths} cuotas
- Etapa actual: ${stageLabel}
- Último contacto: ${contactInfo}
${ctx.notes ? `- Notas: ${ctx.notes}` : ""}

Genera:

### 1. Mensaje de WhatsApp personalizado
Escribe un mensaje directo listo para enviar por WhatsApp. Máximo 4 líneas. Incluye el nombre del prospecto, el producto y una propuesta de valor clara (cuota aproximada). No incluyas emojis en exceso.

### 2. Estrategia de negociación para esta etapa
Describe en 3-4 puntos qué hacer ahora para avanzar al prospecto a la siguiente etapa.

### 3. Objeción más probable + respuesta
¿Cuál es la objeción que más probablemente pondrá ${ctx.prospectName} en esta etapa? Da una respuesta corta y efectiva.`;

  return { system, prompt };
}

/**
 * Genera sugerencia de marketing para un lead dado su contexto.
 * Retorna el texto generado o lanza error si el proveedor falla.
 */
export async function generateMarketingSuggestion(
  ctx: LeadMarketingContext
): Promise<string> {
  const provider = getLLMProvider();
  const { system, prompt } = buildMarketingPrompt(ctx);
  return provider.generate({ system, prompt, maxTokens: 1500 });
}
