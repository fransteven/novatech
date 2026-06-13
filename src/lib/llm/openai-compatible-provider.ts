/**
 * openai-compatible-provider.ts — Cliente fetch para APIs OpenAI-compatibles.
 * Compatible con DeepSeek, Groq, Together AI, OpenAI, etc.
 *
 * Env vars:
 *   LLM_BASE_URL   — ej. https://api.deepseek.com (requerida)
 *   LLM_API_KEY    — API key del proveedor (requerida; alias DEEPSEEK_API_KEY si LLM_PROVIDER=deepseek)
 *   LLM_MODEL      — ej. deepseek-chat (requerida)
 */

import type { LLMProvider, LLMGenerateOptions } from "./provider";

interface ChatCompletionResponse {
  choices: Array<{
    message: { content: string };
  }>;
}

export class OpenAICompatibleProvider implements LLMProvider {
  private baseUrl: string;
  private apiKey: string;
  private model: string;

  constructor() {
    const provider = process.env.LLM_PROVIDER ?? "";
    // Para DeepSeek se acepta DEEPSEEK_API_KEY como alias
    const apiKey =
      process.env.LLM_API_KEY ??
      (provider === "deepseek" ? process.env.DEEPSEEK_API_KEY : undefined);

    if (!apiKey) {
      throw new Error(
        "Falta LLM_API_KEY (o DEEPSEEK_API_KEY si usas DeepSeek). Configura la variable de entorno."
      );
    }
    if (!process.env.LLM_BASE_URL) {
      throw new Error(
        "Falta LLM_BASE_URL. Ej: https://api.deepseek.com"
      );
    }
    if (!process.env.LLM_MODEL) {
      throw new Error(
        "Falta LLM_MODEL. Ej: deepseek-chat"
      );
    }

    this.baseUrl = process.env.LLM_BASE_URL.replace(/\/$/, "");
    this.apiKey = apiKey;
    this.model = process.env.LLM_MODEL;
  }

  async generate({ system, prompt, maxTokens = 1024 }: LLMGenerateOptions): Promise<string> {
    const systemMessage = system ??
      "Eres un asistente de ventas experto en estrategias de marketing y negociación para comercio de tecnología en Colombia.";

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Error del proveedor LLM (${res.status}): ${body}`);
    }

    const data = (await res.json()) as ChatCompletionResponse;
    return data.choices[0]?.message?.content ?? "";
  }
}
