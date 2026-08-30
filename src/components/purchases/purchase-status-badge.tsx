import { Badge } from "@/components/ui/badge";

const CONFIG: Record<string, { label: string; className: string }> = {
  paid: {
    label: "Pagada",
    className:
      "border-emerald-500/40 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400",
  },
  partial: {
    label: "Abono parcial",
    className:
      "border-amber-500/40 text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400",
  },
  pending: {
    label: "A crédito",
    className:
      "border-rose-500/40 text-rose-700 bg-rose-50 dark:bg-rose-950/30 dark:text-rose-400",
  },
};

export function PurchaseStatusBadge({ status }: { status: string }) {
  const config = CONFIG[status];
  if (!config) return <Badge variant="secondary">{status}</Badge>;

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
