"use client";

import { ArrowRight, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/formatters";

interface PurchaseSummaryBarProps {
  total: number;
  subtotal: number;
  extraCostsAmount: number;
  amountPaid: number;
  pending: number;
  loading: boolean;
  duplicateSerialsCount: number;
  missingSerialsCount: number;
  onCancel: () => void;
}

export function PurchaseSummaryBar({
  total,
  subtotal,
  extraCostsAmount,
  amountPaid,
  pending,
  loading,
  duplicateSerialsCount,
  missingSerialsCount,
  onCancel,
}: PurchaseSummaryBarProps) {
  let blockReason: string | null = null;
  if (duplicateSerialsCount > 0) {
    blockReason = `${duplicateSerialsCount} serial${duplicateSerialsCount > 1 ? "es" : ""} repetido${duplicateSerialsCount > 1 ? "s" : ""}`;
  } else if (missingSerialsCount > 0) {
    blockReason = `Faltan ${missingSerialsCount} IMEI${missingSerialsCount > 1 ? "s" : ""}`;
  }

  const isBlocked = Boolean(blockReason);

  return (
    <div className="shrink-0 border-t border-border bg-card/95 backdrop-blur-sm px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
      {/* Resumen numérico */}
      <div className="space-y-0.5 flex items-center justify-between sm:block">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Total
            </span>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors underline decoration-dotted underline-offset-2"
                >
                  Ver desglose <ChevronDown className="h-3 w-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 p-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal productos</span>
                  <span className="font-mono">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Costos adicionales</span>
                  <span className="font-mono">+ {formatCurrency(extraCostsAmount)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Total compra</span>
                  <span className="font-mono text-[color:var(--tf-green)]">
                    {formatCurrency(total)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pagado ahora</span>
                  <span className="font-mono">{formatCurrency(amountPaid)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Saldo al proveedor</span>
                  <span
                    className={`font-mono ${pending > 0 ? "text-[color:var(--tf-amber)] font-medium" : ""}`}
                  >
                    {formatCurrency(pending)}
                  </span>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div
            className="font-mono text-[20px] sm:text-[22px] font-bold text-[color:var(--tf-green)] leading-tight"
            aria-live="polite"
          >
            {formatCurrency(total)}
          </div>
        </div>

        {pending > 0 && (
          <div className="text-[11px] font-mono text-[color:var(--tf-amber)] font-medium text-right sm:text-left">
            Saldo: {formatCurrency(pending)}
          </div>
        )}
      </div>

      {/* Acciones y bloqueo */}
      <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
        {isBlocked && (
          <span className="text-[11px] text-[color:var(--tf-red)] font-medium max-w-[180px] text-right leading-tight hidden sm:inline-block">
            {blockReason}
          </span>
        )}

        <Button
          type="button"
          variant="ghost"
          className="text-[color:var(--tf-fg-muted)] hover:text-foreground flex-1 sm:flex-initial"
          onClick={onCancel}
        >
          Cancelar
        </Button>

        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={isBlocked ? 0 : undefined} className="inline-flex flex-1 sm:flex-initial">
              <Button
                type="submit"
                disabled={loading || isBlocked}
                className="w-full sm:w-auto sm:min-w-[160px] font-semibold"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    Registrar compra
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </>
                )}
              </Button>
            </span>
          </TooltipTrigger>
          {isBlocked && (
            <TooltipContent side="top">
              <p>{blockReason}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </div>
    </div>
  );
}
