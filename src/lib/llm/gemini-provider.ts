/**
 * gemini-provider.ts — Implementación LLM usando @google/genai (Gemini API).
 * Modelo: gemini-3-flash-preview por defecto (override con LLM_MODEL).
 */

import { GoogleGenAI } from "@google/genai";
import type { LLMProvider, LLMGenerateOptions } from "./provider";

export class GeminiProvider implements LLMProvider {
  private client: GoogleGenAI;
  private model: string;

  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error(
        "Falta GEMINI_API_KEY. Configura la variable de entorno para usar Gemini."
      );
    }
    this.client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    this.model = process.env.LLM_MODEL ?? "gemini-3-flash-preview";
  }

  async generate({ system, prompt, maxTokens = 1024 }: LLMGenerateOptions): Promise<string> {
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: prompt,
      config: {
        systemInstruction:
          system ??
          "Eres un asistente de ventas experto en estrategias de marketing y negociación para comercio de tecnología en Colombia.",
        maxOutputTokens: maxTokens,
      },
    });

    return response.text ?? "";
  }
}
