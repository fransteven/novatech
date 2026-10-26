/**
 * provider.ts — Interfaz agnóstica de proveedor LLM.
 * Implementaciones: ClaudeProvider (Anthropic SDK) y OpenAICompatibleProvider (fetch).
 */

export interface LLMGenerateOptions {
  system?: string;
  prompt: string;
  maxTokens?: number;
  /** Imágenes adjuntas al prompt (base64 sin prefijo data:). */
  images?: LLMImage[];
  /** Pide la respuesta como JSON (si el proveedor lo soporta). */
  json?: boolean;
}

export interface LLMImage {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  data: string;
}

export interface LLMProvider {
  generate(opts: LLMGenerateOptions): Promise<string>;
}
