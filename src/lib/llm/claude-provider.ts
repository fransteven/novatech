/**
 * claude-provider.ts — Implementación LLM usando @anthropic-ai/sdk.
 * Modelo: claude-opus-4-8 por defecto (override con LLM_MODEL).
 */

import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider, LLMGenerateOptions } from "./provider";

export class ClaudeProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        "Falta ANTHROPIC_API_KEY. Configura la variable de entorno para usar Claude."
      );
    }
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.model = process.env.LLM_MODEL ?? "claude-opus-4-8";
  }

  async generate({ system, prompt, maxTokens = 1024 }: LLMGenerateOptions): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      thinking: { type: "adaptive" },
      system: system ?? "Eres un asistente de ventas experto en estrategias de marketing y negociación para comercio de tecnología en Colombia.",
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    return textBlock && textBlock.type === "text" ? textBlock.text : "";
  }
}
