import * as React from "react";
import { Wallet, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  sub: string;
  icon: React.ReactNode;
  iconBg: string;
  iconFg: string;
  glow: string;
  alert?: boolean;
}

function KpiCard({ label, value, sub, icon, iconBg, iconFg, glow, alert }: KpiCardProps) {
  return (
    <div
      className={`relative overflow-hidden bg-card border border-border rounded-[14px] p-5 transition-all duration-200 hover:-translate-y-0.5${alert ? " tf-kpi-alert" : ""}`}
      style={{ boxShadow: "var(--tf-shadow-sm)" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(120% 60% at 100% 0%, ${glow}, transparent 50%)`,
          opacity: 0.4,
        }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-2">
            {label}
          </p>
          <div className="text-[28px] font-bold tracking-[-0.03em] tabular-nums leading-tight text-foreground break-all">
            {value}
          </div>
          <p className="text-[12px] text-muted-foreground mt-1.5">{sub}</p>
        </div>
        <div
          className="w-9 h-9 rounded-[9px] flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: iconBg, color: iconFg }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

interface CashKpisProps {
  totalBalance: number;
  totalIn: number;
  totalOut: number;
  netFlow: number;
}

export function CashKpis({ totalBalance, totalIn, totalOut, netFlow }: CashKpisProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        label="Saldo Total"
        value={<span className="text-[22px]">{formatCurrency(totalBalance)}</span>}
        sub="Suma de todas las cuentas activas"
        icon={<Wallet className="h-[18px] w-[18px]" />}
        iconBg="oklch(0.58 0.19 265 / 0.15)"
        iconFg="oklch(0.58 0.19 265)"
        glow="oklch(0.58 0.19 265 / 0.18)"
      />
      <KpiCard
        label="Ingresos del Mes"
        value={<span className="text-[22px]">{formatCurrency(totalIn)}</span>}
        sub="Entradas del mes actual"
        icon={<TrendingUp className="h-[18px] w-[18px]" />}
        iconBg="oklch(0.62 0.15 150 / 0.15)"
        iconFg="oklch(0.62 0.15 150)"
        glow="oklch(0.62 0.15 150 / 0.16)"
      />
      <KpiCard
        label="Egresos del Mes"
        value={<span className="text-[22px]">{formatCurrency(totalOut)}</span>}
        sub="Salidas del mes actual"
        icon={<TrendingDown className="h-[18px] w-[18px]" />}
        iconBg="oklch(0.6 0.2 25 / 0.12)"
        iconFg="oklch(0.6 0.2 25)"
        glow="oklch(0.6 0.2 25 / 0.14)"
      />
      <KpiCard
        label="Flujo Neto"
        value={<span className="text-[22px]">{formatCurrency(netFlow)}</span>}
        sub={netFlow >= 0 ? "Flujo positivo este mes" : "Flujo negativo este mes"}
        icon={<Activity className="h-[18px] w-[18px]" />}
        iconBg="oklch(0.72 0.15 70 / 0.15)"
        iconFg="oklch(0.72 0.15 70)"
        glow="oklch(0.72 0.15 70 / 0.18)"
        alert={netFlow < 0}
      />
    </div>
  );
}
