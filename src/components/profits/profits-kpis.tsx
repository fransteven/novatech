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
  /** Período que resumen estas cifras, para que no se lean como "el mes". */
  periodLabel: string;
}

export function ProfitsKPIs({ kpis, periodLabel }: ProfitsKPIsProps) {
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

  const netClass =
    netProfit >= 0
      ? "text-[color:var(--tf-green)]"
      : "text-[color:var(--tf-red)]";

  return (
    <>
      {/*
        Móvil: las 8 tarjetas apiladas obligaban a recorrer 4 pantallas para
        llegar a la utilidad. Aquí el dato que se viene a buscar va primero y el
        resto se lee como un estado de resultados, que además muestra de dónde
        sale el número en lugar de dejar 8 cifras sueltas.
      */}
      <section className="sm:hidden rounded-[12px] border border-border bg-card">
        <header className="border-b border-border px-4 py-4">
          <p className="mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--tf-fg-subtle)]">
            Utilidad neta · {periodLabel}
          </p>
          <div className="mt-1.5 flex items-baseline justify-between gap-3">
            <span
              className={`mono text-[30px] font-semibold leading-none tracking-[-0.04em] ${netClass}`}
            >
              {formatCurrency(netProfit)}
            </span>
            <span className="mono shrink-0 text-[11px] text-muted-foreground">
              margen {formatPercentCO(grossMarginPct / 100)}
            </span>
          </div>
        </header>

        <dl className="divide-y divide-border/60 px-4 text-[13px]">
          <StatementRow label="Ventas" value={salesRevenue} />
          <StatementRow
            label="Intereses de crédito"
            value={interestIncome}
            valueClassName="text-[color:var(--tf-accent)]"
          />
          <StatementRow label="Otros ingresos" value={otherIncome} />
          <StatementRow label="Ingresos totales" value={totalIncome} emphasis />
          <StatementRow label="Costo de ventas" value={-totalCost} />
          <StatementRow label="Utilidad bruta" value={grossProfit} emphasis />
          <StatementRow label="Gastos operativos" value={-totalExpenses} />
        </dl>

        <footer className="border-t border-border px-4 py-3">
          <p className="text-[11px] leading-relaxed text-[color:var(--tf-fg-subtle)]">
            {totalSold} unidad{totalSold === 1 ? "" : "es"} vendida
            {totalSold === 1 ? "" : "s"} · margen de producto{" "}
            {formatPercentCO(productMarginPct / 100)}
            <br />
            Cartera prestada al cierre:{" "}
            <span className="mono text-foreground">
              {formatCurrency(kpis.activeLoanPortfolio ?? 0)}
            </span>
          </p>
        </footer>
      </section>

      {/* Escritorio: rejilla de tarjetas, sin cambios de contenido. */}
      <div className="hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-3">
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
          valueClassName={netClass}
        />
        <KpiCard
          icon={Landmark}
          title="Cartera Prestada"
          value={formatCurrency(kpis.activeLoanPortfolio ?? 0)}
          description="Capital insoluto de préstamos al cierre del período"
          valueClassName="text-primary"
        />
      </div>
    </>
  );
}

function StatementRow({
  label,
  value,
  emphasis = false,
  valueClassName,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt
        className={
          emphasis
            ? "font-medium text-foreground"
            : "text-[color:var(--tf-fg-muted)]"
        }
      >
        {label}
      </dt>
      <dd
        className={`mono tabular-nums whitespace-nowrap ${
          emphasis ? "font-semibold" : ""
        } ${valueClassName ?? (value < 0 ? "text-[color:var(--tf-red)]" : "")}`}
      >
        {value === 0 ? "—" : formatCurrency(value)}
      </dd>
    </div>
  );
}
