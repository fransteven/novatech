/**
 * provider.ts — Interfaz agnóstica de proveedor LLM.
 * Implementaciones: ClaudeProvider (Anthropic SDK) y OpenAICompatibleProvider (fetch).
 */

export interface LLMGenerateOptions {
  system?: string;
  prompt: string;
  maxTokens?: number;
}

export interface LLMProvider {
  generate(opts: LLMGenerateOptions): Promise<string>;
}
