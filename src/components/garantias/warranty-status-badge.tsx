import { Badge } from "@/components/ui/badge";
import type { WarrantyStatus } from "@/lib/warranty/warranty-row";

const CONFIG: Record<
  WarrantyStatus,
  { label: string; variant: "default" | "destructive" | "secondary"; className?: string }
> = {
  vigente: {
    label: "Vigente",
    variant: "default",
    className: "bg-emerald-500 hover:bg-emerald-600 text-white",
  },
  vencida: { label: "Vencida", variant: "destructive" },
  sin_cobertura: { label: "Anulada", variant: "secondary" },
};

export function WarrantyStatusBadge({ status }: { status: WarrantyStatus }) {
  const config = CONFIG[status];
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}
