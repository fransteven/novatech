"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";
import { getMarketingSuggestionAction } from "@/app/actions/lead-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface MarketingSuggestionsProps {
  leadId: string;
  /** Última sugerencia guardada como actividad (puede venir del historial) */
  lastSuggestion?: string | null;
}

export function MarketingSuggestions({
  leadId,
  lastSuggestion,
}: MarketingSuggestionsProps) {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(
    lastSuggestion ?? null
  );
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    const result = await getMarketingSuggestionAction(leadId);
    setLoading(false);
    if (result.success && result.data) {
      setSuggestion(result.data);
    } else {
      setError(result.error ?? "Error al generar la sugerencia");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Genera copy de WhatsApp personalizado, estrategia de negociación y
          respuesta a objeciones basada en el estado actual del lead.
        </p>
        <Button
          onClick={handleGenerate}
          disabled={loading}
          size="sm"
          className="shrink-0 ml-4"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generando…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generar con IA
            </>
          )}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {suggestion && !error && (
        <div className="rounded-lg border bg-muted/30 p-4">
          <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">
            {suggestion}
          </pre>
        </div>
      )}

      {!suggestion && !error && !loading && (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Haz clic en "Generar con IA" para obtener sugerencias personalizadas.
        </div>
      )}
    </div>
  );
}
