import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusKey =
  | "active"
  | "completed"
  | "cancelled"
  | "overdue"
  | "low"
  | "ok"
  | string;

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: BadgeVariant; className?: string }
> = {
  active: {
    label: "Activo",
    variant: "outline",
    className:
      "tf-badge-low",
  },
  completed: {
    label: "Completado",
    variant: "default",
    className: "tf-badge-normal",
  },
  cancelled: { label: "Cancelado", variant: "destructive" },
  overdue: { label: "Vencido", variant: "destructive" },
  low: { label: "Bajo", variant: "destructive" },
  ok: { label: "OK", variant: "default" },
};

interface StatusBadgeProps {
  status: StatusKey;
  /** Override the display label */
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    variant: "secondary" as BadgeVariant,
  };

  return (
    <Badge
      variant={config.variant}
      className={cn(config.className, className)}
    >
      {label ?? config.label}
    </Badge>
  );
}
