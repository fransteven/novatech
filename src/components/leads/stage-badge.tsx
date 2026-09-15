import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STAGE_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  nuevo: {
    label: "Nuevo",
    className: "bg-muted text-muted-foreground border-border",
  },
  contactado: {
    label: "Contactado",
    className: "tf-badge-low",
  },
  negociando: {
    label: "Negociando",
    className: "bg-accent text-accent-foreground border-primary/25",
  },
  ganado: {
    label: "Ganado",
    className: "tf-badge-normal",
  },
  perdido: {
    label: "Perdido",
    className: "tf-badge-out",
  },
};

interface StageBadgeProps {
  stage: string;
  className?: string;
}

export function StageBadge({ stage, className }: StageBadgeProps) {
  const config = STAGE_CONFIG[stage] ?? { label: stage, className: "" };
  return (
    <Badge
      variant="outline"
      className={cn("font-medium text-xs", config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
