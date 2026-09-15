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
    colorClass = "tf-badge-normal";
  } else if (status === "cancelled") {
    label = "Cancelado";
    colorClass = "bg-muted text-muted-foreground border-border";
  } else if (status === "defaulted") {
    label = "Castigado (Default)";
    colorClass = "tf-badge-out";
  } else if (subStatus === "en_mora") {
    label = "En mora";
    colorClass = "tf-badge-low";
  } else {
    label = "Al día";
    colorClass = "bg-muted text-muted-foreground border-border";
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
            riskLevel === "rojo" && "tf-badge-out",
            riskLevel === "amarillo" && "tf-badge-low",
            riskLevel === "verde" && "tf-badge-normal"
          )}
        >
          {riskLevel === "rojo" ? "🔴 Alto riesgo" : riskLevel === "amarillo" ? "🟡 Riesgo medio" : "🟢 Bajo"}
        </span>
      )}
    </div>
  );
}
