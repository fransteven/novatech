import { KpiCard } from "@/components/ui/kpi-card";
import {
  TrendingUp,
  TrendingDown,
  CircleDollarSign,
  ShoppingCart,
  Percent,
} from "lucide-react";
import type { ProfitsKPIs } from "@/services/profits-service";

const fmt = (amount: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(amount);

interface ProfitsKPIsProps {
  kpis: ProfitsKPIs;
}

export function ProfitsKPIs({ kpis }: ProfitsKPIsProps) {
  const {
    totalRevenue,
    totalCost,
    grossProfit,
    totalExpenses,
    interestIncome,
    netProfit,
    totalSold,
    grossMarginPct,
  } = kpis;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <KpiCard
        icon={ShoppingCart}
        title="Ingresos por Ventas"
        value={fmt(totalRevenue)}
        description={`${totalSold} unidad${totalSold === 1 ? "" : "es"} vendida${totalSold === 1 ? "" : "s"}`}
      />
      <KpiCard
        icon={Percent}
        title="Ingresos por Intereses"
        value={fmt(interestIncome)}
        description="Intereses cobrados en créditos"
        valueClassName="text-[color:var(--tf-accent)]"
      />
      <KpiCard
        icon={TrendingDown}
        title="Costo de Ventas"
        value={fmt(totalCost)}
        description="Costo de los productos vendidos"
      />
      <KpiCard
        icon={TrendingUp}
        title="Utilidad Bruta"
        value={fmt(grossProfit)}
        description={`Margen bruto ${grossMarginPct.toFixed(1)}%`}
        valueClassName="text-[color:var(--tf-green)]"
      />
      <KpiCard
        icon={TrendingDown}
        title="Gastos Operativos"
        value={fmt(totalExpenses)}
        description="Gastos registrados en el período"
      />
      <KpiCard
        icon={CircleDollarSign}
        title="Utilidad Neta"
        value={fmt(netProfit)}
        description="Utilidad bruta menos gastos"
        valueClassName={
          netProfit >= 0
            ? "text-[color:var(--tf-green)]"
            : "text-[color:var(--tf-red)]"
        }
      />
    </div>
  );
}
