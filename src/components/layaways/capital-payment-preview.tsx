import { AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { AbonoCapitalPreview } from "@/lib/credit/payments";

interface CapitalPaymentPreviewProps {
  preview: AbonoCapitalPreview | null;
  currentInstallment: number;
  currentPendingCount: number;
}

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Muestra el efecto del abono a capital antes de confirmarlo. */
export const CapitalPaymentPreview = ({
  preview,
  currentInstallment,
  currentPendingCount,
}: CapitalPaymentPreviewProps) => {
  if (!preview) return null;

  if (!preview.ok) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{preview.error}</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-3 text-xs">
      <span className="text-muted-foreground">Cuota</span>
      <span className="text-right font-mono">
        {formatCurrency(currentInstallment)} → <strong>{formatCurrency(preview.installment)}</strong>
      </span>
      <span className="text-muted-foreground">Cuotas pendientes</span>
      <span className="text-right font-mono">
        {currentPendingCount} → <strong>{preview.pendingCount}</strong>
      </span>
      <span className="text-muted-foreground">Última cuota</span>
      <span className="text-right">{dateFormatter.format(preview.lastDueDate)}</span>
      <span className="text-muted-foreground">Interés restante</span>
      <span className="text-right font-mono">{formatCurrency(preview.totalInterest)}</span>
    </div>
  );
};
