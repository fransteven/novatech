import { Package, DollarSign, AlertTriangle, TrendingUp } from "lucide-react";
import { formatCurrency, formatNumberCO } from "@/lib/formatters";

interface InventoryKPIsProps {
  stats: {
    totalValue: number;
    totalUnits: number;
    lowStockCount: number;
  };
}

export function InventoryKPIs({ stats }: InventoryKPIsProps) {
  const cards = [
    {
      label: "Valor Total del Inventario",
      icon: DollarSign,
      value: formatCurrency(stats.totalValue),
      unit: "COP",
      delta: { variant: "up" as const, label: "+", text: "Valor de mercancía" },
      iconBg: "var(--tf-green-soft)",
      iconFg: "var(--tf-green)",
      alert: false,
    },
    {
      label: "Unidades Totales",
      icon: Package,
      value: formatNumberCO(stats.totalUnits),
      unit: "unidades",
      delta: { variant: "up" as const, label: "+", text: "Productos disponibles" },
      iconBg: "var(--tf-accent-soft)",
      iconFg: "var(--tf-accent)",
      alert: false,
    },
    {
      label: "Stock Bajo / Agotado",
      icon: AlertTriangle,
      value: String(stats.lowStockCount),
      unit: "productos",
      delta: {
        variant: stats.lowStockCount > 0 ? ("warn" as const) : ("up" as const),
        label: stats.lowStockCount > 0 ? "Atención" : "OK",
        text: stats.lowStockCount > 0 ? "Requiere reposición" : "Stock en buen nivel",
      },
      iconBg: "var(--tf-amber-soft)",
      iconFg: "var(--tf-amber)",
      alert: stats.lowStockCount > 0,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((card, i) => (
        <div
          key={i}
          className={`relative overflow-hidden bg-card border border-border rounded-[14px] p-5 before:absolute before:inset-y-5 before:left-0 before:w-px before:bg-[var(--tf-accent)]${card.alert ? " tf-kpi-alert" : ""}`}
          style={
            {
              borderColor: card.alert
                ? "color-mix(in oklch, var(--tf-amber) 40%, var(--tf-border))"
                : undefined,
            } as React.CSSProperties
          }
        >
          {/* Head */}
          <div className="relative flex items-center justify-between mb-[14px]">
            <span className="text-[13px] font-medium text-[color:var(--tf-fg-muted)]">
              {card.label}
            </span>
            <span
              className="w-9 h-9 rounded-[9px] grid place-items-center"
              style={{ background: card.iconBg, color: card.iconFg }}
            >
              <card.icon className="h-[18px] w-[18px]" />
            </span>
          </div>

          {/* Value */}
          <div className="relative text-[28px] font-bold tracking-[-0.03em] mb-1 leading-[1.1]" style={{ fontFeatureSettings: '"tnum"' }}>
            {card.value}
            <span className="text-base font-medium text-[color:var(--tf-fg-muted)] ml-0.5">{" "}{card.unit}</span>
          </div>

          {/* Foot */}
          <div className="relative flex items-center gap-2 text-[12.5px] text-[color:var(--tf-fg-subtle)]">
            <span
              className={`inline-flex items-center gap-1 font-semibold px-[6px] py-px rounded-[5px] ${
                card.delta.variant === "warn"
                  ? "bg-[var(--tf-amber-soft)] text-[color:var(--tf-amber)]"
                  : "bg-[var(--tf-green-soft)] text-[color:var(--tf-green)]"
              }`}
            >
              {card.delta.variant === "up" && <TrendingUp className="h-[11px] w-[11px]" />}
              {card.delta.variant === "warn" && <AlertTriangle className="h-[11px] w-[11px]" />}
              {card.delta.label}
            </span>
            <span>{card.delta.text}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
