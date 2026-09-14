import { KpiCard } from "@/components/ui/kpi-card";
import {
  TrendingUp,
  TrendingDown,
  CircleDollarSign,
  ShoppingCart,
  Percent,
  Landmark,
} from "lucide-react";
import type { ProfitsKPIs } from "@/services/profits-service";
import { formatCurrency, formatPercentCO } from "@/lib/formatters";

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
        value={formatCurrency(salesRevenue)}
        description={`${totalSold} unidad${totalSold === 1 ? "" : "es"} vendida${totalSold === 1 ? "" : "s"}`}
      />
      <KpiCard
        icon={Percent}
        title="Ingresos por Intereses"
        value={formatCurrency(interestIncome)}
        description="Intereses cobrados en créditos"
        valueClassName="text-[color:var(--tf-accent)]"
      />
      <KpiCard
        icon={CircleDollarSign}
        title="Ingresos Totales"
        value={formatCurrency(totalIncome)}
        description={
          otherIncome > 0
            ? `Ventas, intereses y ${formatCurrency(otherIncome)} de otros ingresos`
            : "Ventas más intereses de crédito"
        }
      />
      <KpiCard
        icon={TrendingDown}
        title="Costo de Ventas"
        value={formatCurrency(totalCost)}
        description={`Costo de los productos vendidos · margen de producto ${formatPercentCO(productMarginPct / 100)}`}
      />
      <KpiCard
        icon={TrendingUp}
        title="Utilidad Bruta"
        value={formatCurrency(grossProfit)}
        description={`Ingresos totales menos costo · margen ${formatPercentCO(grossMarginPct / 100)}`}
        valueClassName="text-[color:var(--tf-green)]"
      />
      <KpiCard
        icon={TrendingDown}
        title="Gastos Operativos"
        value={formatCurrency(totalExpenses)}
        description="Gastos registrados en el período"
      />
      <KpiCard
        icon={CircleDollarSign}
        title="Utilidad Neta"
        value={formatCurrency(netProfit)}
        description="Utilidad bruta menos gastos"
        valueClassName={
          netProfit >= 0
            ? "text-[color:var(--tf-green)]"
            : "text-[color:var(--tf-red)]"
        }
      />
      <KpiCard
        icon={Landmark}
        title="Cartera Prestada"
        value={formatCurrency(kpis.activeLoanPortfolio ?? 0)}
        description="Capital insoluto activo en préstamos"
        valueClassName="text-primary"
      />
    </div>
  );
}
