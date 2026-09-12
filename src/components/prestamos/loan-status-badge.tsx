import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface LoanStatusBadgeProps {
  status: string;
  subStatus?: string | null;
  riskLevel?: string | null;
  className?: string;
  showRisk?: boolean;
}

export function LoanStatusBadge({
  status,
  subStatus,
  riskLevel,
  className,
  showRisk = false,
}: LoanStatusBadgeProps) {
  let label = "Activo";
  let colorClass = "bg-primary/10 text-primary border-primary/20";

  if (status === "completed") {
    label = "Completado";
    colorClass = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800";
  } else if (status === "cancelled") {
    label = "Cancelado";
    colorClass = "bg-muted text-muted-foreground border-border";
  } else if (status === "defaulted") {
    label = "Castigado (Default)";
    colorClass = "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800";
  } else if (subStatus === "en_mora") {
    label = "En mora";
    colorClass = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800";
  } else {
    label = "Al día";
    colorClass = "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800";
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <Badge
        variant="outline"
        className={cn("font-medium tracking-tight text-xs py-0.5 px-2.5", colorClass, className)}
      >
        {label}
      </Badge>

      {showRisk && riskLevel && status === "active" && (
        <span
          className={cn(
            "text-[11px] font-medium px-2 py-0.5 rounded-full border",
            riskLevel === "rojo" && "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400",
            riskLevel === "amarillo" && "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-400",
            riskLevel === "verde" && "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400"
          )}
        >
          {riskLevel === "rojo" ? "🔴 Alto riesgo" : riskLevel === "amarillo" ? "🟡 Riesgo medio" : "🟢 Bajo"}
        </span>
      )}
    </div>
  );
}
