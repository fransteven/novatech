/**
 * index.ts — Factory de proveedor LLM.
 * Lee LLM_PROVIDER para seleccionar la implementación.
 *
 * LLM_PROVIDER = "claude"              → ClaudeProvider (ANTHROPIC_API_KEY)
 * LLM_PROVIDER = "deepseek"            → OpenAICompatibleProvider (DEEPSEEK_API_KEY, LLM_BASE_URL, LLM_MODEL)
 * LLM_PROVIDER = "openai-compatible"   → OpenAICompatibleProvider (LLM_API_KEY, LLM_BASE_URL, LLM_MODEL)
 *
 * Auto-detecta: si hay ANTHROPIC_API_KEY y no se especificó proveedor → claude.
 *               si hay DEEPSEEK_API_KEY → deepseek.
 */

import type { LLMProvider } from "./provider";

export type { LLMProvider, LLMGenerateOptions } from "./provider";

export function getLLMProvider(): LLMProvider {
  const provider =
    process.env.LLM_PROVIDER ??
    (process.env.ANTHROPIC_API_KEY
      ? "claude"
      : process.env.DEEPSEEK_API_KEY
      ? "deepseek"
      : undefined);

  if (!provider) {
    throw new Error(
      "No hay proveedor LLM configurado. " +
        "Agrega LLM_PROVIDER=claude (con ANTHROPIC_API_KEY) o " +
        "LLM_PROVIDER=deepseek (con DEEPSEEK_API_KEY, LLM_BASE_URL, LLM_MODEL) al .env."
    );
  }

  switch (provider) {
    case "claude": {
      const { ClaudeProvider } = require("./claude-provider") as {
        ClaudeProvider: new () => LLMProvider;
      };
      return new ClaudeProvider();
    }
    case "deepseek":
    case "openai-compatible": {
      const { OpenAICompatibleProvider } = require("./openai-compatible-provider") as {
        OpenAICompatibleProvider: new () => LLMProvider;
      };
      return new OpenAICompatibleProvider();
    }
    default:
      throw new Error(`Proveedor LLM desconocido: "${provider}". Usa "claude", "deepseek" u "openai-compatible".`);
  }
}
