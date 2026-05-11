import { Package, DollarSign, AlertTriangle, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

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
      unit: "MXN",
      delta: { variant: "up" as const, label: "+", text: "Valor de mercancía" },
      glow: "oklch(0.65 0.16 150 / 0.16)",
      iconBg: "oklch(0.95 0.05 150)",
      iconFg: "oklch(0.45 0.15 150)",
      alert: false,
    },
    {
      label: "Unidades Totales",
      icon: Package,
      value: stats.totalUnits.toLocaleString("es-MX"),
      unit: "unidades",
      delta: { variant: "up" as const, label: "+", text: "Productos disponibles" },
      glow: "oklch(0.62 0.18 265 / 0.18)",
      iconBg: "oklch(0.95 0.04 265)",
      iconFg: "oklch(0.5 0.18 265)",
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
      glow: "oklch(0.72 0.15 70 / 0.18)",
      iconBg: "oklch(0.96 0.06 70)",
      iconFg: "oklch(0.55 0.15 70)",
      alert: stats.lowStockCount > 0,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((card, i) => (
        <div
          key={i}
          className="relative overflow-hidden bg-card border border-border rounded-[14px] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--tf-shadow-md)]"
          style={
            {
              "--kpi-glow": card.glow,
              borderColor: card.alert
                ? "color-mix(in oklch, var(--tf-amber) 40%, var(--tf-border))"
                : undefined,
            } as React.CSSProperties
          }
        >
          {/* Alert stripe */}
          {card.alert && <span className="tf-kpi-alert" />}

          {/* Glow overlay */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background: `radial-gradient(120% 60% at 100% 0%, ${card.glow}, transparent 50%)`,
            }}
          />

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
