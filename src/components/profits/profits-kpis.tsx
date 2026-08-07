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
    salesRevenue,
    interestIncome,
    otherIncome,
    totalIncome,
    totalCost,
    grossProfit,
    totalExpenses,
    netProfit,
    totalSold,
    grossMarginPct,
    productMarginPct,
  } = kpis;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <KpiCard
        icon={ShoppingCart}
        title="Ingresos por Ventas"
        value={fmt(salesRevenue)}
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
        icon={CircleDollarSign}
        title="Ingresos Totales"
        value={fmt(totalIncome)}
        description={
          otherIncome > 0
            ? `Ventas, intereses y ${fmt(otherIncome)} de otros ingresos`
            : "Ventas más intereses de crédito"
        }
      />
      <KpiCard
        icon={TrendingDown}
        title="Costo de Ventas"
        value={fmt(totalCost)}
        description={`Costo de los productos vendidos · margen de producto ${productMarginPct.toFixed(1)}%`}
      />
      <KpiCard
        icon={TrendingUp}
        title="Utilidad Bruta"
        value={fmt(grossProfit)}
        description={`Ingresos totales menos costo · margen ${grossMarginPct.toFixed(1)}%`}
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
