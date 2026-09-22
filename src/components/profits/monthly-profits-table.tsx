"use client";

import { Fragment, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { MonthlyProfit, MonthlyProfitBreakdown } from "@/services/profits-service";
import { getMonthlyProfitBreakdownAction } from "@/app/actions/profits-actions";
import { formatCurrency } from "@/lib/formatters";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const fmt = formatCurrency;

const fmtDate = (date: Date | string) =>
  new Date(date).toLocaleDateString("es-CO", { day: "2-digit", month: "short" });

const hasData = (row: MonthlyProfit) =>
  row.totalIncome > 0 || row.cost > 0 || row.expenses > 0;

interface MonthlyProfitsTableProps {
  data: MonthlyProfit[];
  year: number;
}

export function MonthlyProfitsTable({ data, year }: MonthlyProfitsTableProps) {
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);
  const [breakdowns, setBreakdowns] = useState<
    Record<number, MonthlyProfitBreakdown>
  >({});
  const [loadingMonth, setLoadingMonth] = useState<number | null>(null);

  const totals = data.reduce(
    (acc, row) => ({
      salesRevenue: acc.salesRevenue + row.salesRevenue,
      interestIncome: acc.interestIncome + row.interestIncome,
      otherIncome: acc.otherIncome + row.otherIncome,
      totalIncome: acc.totalIncome + row.totalIncome,
      cost: acc.cost + row.cost,
      grossProfit: acc.grossProfit + row.grossProfit,
      expenses: acc.expenses + row.expenses,
      netProfit: acc.netProfit + row.netProfit,
    }),
    {
      salesRevenue: 0,
      interestIncome: 0,
      otherIncome: 0,
      totalIncome: 0,
      cost: 0,
      grossProfit: 0,
      expenses: 0,
      netProfit: 0,
    },
  );

  const toggleMonth = async (month: number) => {
    if (expandedMonth === month) {
      setExpandedMonth(null);
      return;
    }
    setExpandedMonth(month);
    if (breakdowns[month]) return;

    setLoadingMonth(month);
    const result = await getMonthlyProfitBreakdownAction(year, month);
    if (result.success && result.data) {
      setBreakdowns((prev) => ({ ...prev, [month]: result.data! }));
    }
    setLoadingMonth(null);
  };

  const monthsWithData = data.filter(hasData);

  return (
    <>
      {/*
        Móvil: la tabla de 9 columnas vivía dentro de un scroll horizontal de
        780px, ilegible en un teléfono. Aquí cada mes es una tarjeta con la
        utilidad neta como titular y el resto del renglón debajo; los meses sin
        movimiento no se pintan en vez de ocupar 12 filas de guiones.
      */}
      <div className="space-y-2 sm:hidden">
        {monthsWithData.length === 0 ? (
          <p className="rounded-[12px] border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted-foreground">
            Sin movimientos registrados en {year}.
          </p>
        ) : (
          monthsWithData.map((row) => {
            const isExpanded = expandedMonth === row.month;
            const breakdown = breakdowns[row.month];
            const isLoading = loadingMonth === row.month;

            return (
              <div
                key={row.month}
                className="overflow-hidden rounded-[12px] border border-border bg-card"
              >
                <button
                  type="button"
                  onClick={() => toggleMonth(row.month)}
                  aria-expanded={isExpanded}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors active:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-[14px] font-semibold">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-[color:var(--tf-fg-subtle)]" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-[color:var(--tf-fg-subtle)]" />
                      )}
                      {MONTH_NAMES[row.month - 1]}
                    </p>
                    <p className="mono mt-1 pl-5.5 text-[11px] text-[color:var(--tf-fg-subtle)]">
                      margen{" "}
                      {row.totalIncome > 0
                        ? `${Math.round((row.grossProfit / row.totalIncome) * 100)}%`
                        : "—"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={`mono text-[17px] font-semibold tabular-nums leading-none ${
                        row.netProfit >= 0
                          ? "text-[color:var(--tf-green)]"
                          : "text-[color:var(--tf-red)]"
                      }`}
                    >
                      {fmt(row.netProfit)}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-[color:var(--tf-fg-subtle)]">
                      Utilidad neta
                    </p>
                  </div>
                </button>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-border/60 px-4 py-3 text-[12px]">
                  <MobileStat label="Ventas" value={row.salesRevenue} />
                  <MobileStat
                    label="Intereses"
                    value={row.interestIncome}
                    valueClassName="text-[color:var(--tf-accent)]"
                  />
                  <MobileStat label="Costo" value={row.cost} />
                  <MobileStat label="Gastos" value={row.expenses} />
                  {row.otherIncome > 0 && (
                    <MobileStat label="Otros ingresos" value={row.otherIncome} />
                  )}
                  <MobileStat
                    label="Utilidad bruta"
                    value={row.grossProfit}
                    valueClassName={
                      row.grossProfit >= 0
                        ? "text-[color:var(--tf-green)]"
                        : "text-[color:var(--tf-red)]"
                    }
                  />
                </dl>

                {isExpanded && (
                  <div className="border-t border-border bg-muted/20 px-3 py-3">
                    {isLoading || !breakdown ? (
                      <p className="text-xs text-muted-foreground">
                        Cargando desglose...
                      </p>
                    ) : (
                      <MonthBreakdownDetail breakdown={breakdown} />
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        <div className="flex items-center justify-between rounded-[12px] border border-border bg-muted/40 px-4 py-3">
          <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[color:var(--tf-fg-subtle)]">
            Total {year}
          </span>
          <span
            className={`mono text-[15px] font-bold tabular-nums ${
              totals.netProfit >= 0
                ? "text-[color:var(--tf-green)]"
                : "text-[color:var(--tf-red)]"
            }`}
          >
            {fmt(totals.netProfit)}
          </span>
        </div>
      </div>

      {/* Escritorio: la tabla completa. */}
      <div className="hidden rounded-[12px] border border-border overflow-x-auto sm:block">
      <table className="w-full text-sm min-w-[780px]">
        <thead className="bg-muted/50">
          <tr className="border-b border-border">
            <th className="px-4 py-3 text-left font-semibold text-[12px] uppercase tracking-wide text-[color:var(--tf-fg-subtle)]">
              Mes
            </th>
            <th className="px-4 py-3 text-right font-semibold text-[12px] uppercase tracking-wide text-[color:var(--tf-fg-subtle)]">
              Ventas
            </th>
            <th className="px-4 py-3 text-right font-semibold text-[12px] uppercase tracking-wide text-[color:var(--tf-fg-subtle)]">
              Intereses
            </th>
            <th className="px-4 py-3 text-right font-semibold text-[12px] uppercase tracking-wide text-[color:var(--tf-fg-subtle)]">
              Otros
            </th>
            <th className="px-4 py-3 text-right font-semibold text-[12px] uppercase tracking-wide text-[color:var(--tf-fg-subtle)]">
              Ingresos
            </th>
            <th className="px-4 py-3 text-right font-semibold text-[12px] uppercase tracking-wide text-[color:var(--tf-fg-subtle)]">
              Costo
            </th>
            <th className="px-4 py-3 text-right font-semibold text-[12px] uppercase tracking-wide text-[color:var(--tf-fg-subtle)]">
              Util. Bruta
            </th>
            <th className="px-4 py-3 text-right font-semibold text-[12px] uppercase tracking-wide text-[color:var(--tf-fg-subtle)]">
              Gastos
            </th>
            <th className="px-4 py-3 text-right font-semibold text-[12px] uppercase tracking-wide text-[color:var(--tf-fg-subtle)]">
              Util. Neta
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const clickable = hasData(row);
            const isExpanded = expandedMonth === row.month;
            const breakdown = breakdowns[row.month];
            const isLoading = loadingMonth === row.month;

            return (
              <Fragment key={row.month}>
                <tr
                  onClick={clickable ? () => toggleMonth(row.month) : undefined}
                  className={`border-b border-border last:border-0 transition-colors ${
                    clickable ? "hover:bg-muted/30 cursor-pointer" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-[13px]">
                    <span className="inline-flex items-center gap-1.5">
                      {clickable ? (
                        isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-[color:var(--tf-fg-subtle)]" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-[color:var(--tf-fg-subtle)]" />
                        )
                      ) : (
                        <span className="w-3.5" />
                      )}
                      {MONTH_NAMES[row.month - 1]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-[13px] text-muted-foreground">
                    {row.salesRevenue > 0 ? fmt(row.salesRevenue) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-[13px] text-[color:var(--tf-accent)]">
                    {row.interestIncome > 0 ? fmt(row.interestIncome) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-[13px] text-muted-foreground">
                    {row.otherIncome > 0 ? fmt(row.otherIncome) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-[13px] font-medium">
                    {row.totalIncome > 0 ? fmt(row.totalIncome) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-[13px] text-muted-foreground">
                    {row.cost > 0 ? fmt(row.cost) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-[13px] font-medium">
                    {row.grossProfit > 0 ? (
                      <span className="text-[color:var(--tf-green)]">{fmt(row.grossProfit)}</span>
                    ) : row.grossProfit < 0 ? (
                      <span className="text-[color:var(--tf-red)]">{fmt(row.grossProfit)}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-[13px] text-muted-foreground">
                    {row.expenses > 0 ? fmt(row.expenses) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-[13px] font-semibold">
                    {row.netProfit !== 0 ? (
                      <span
                        className={
                          row.netProfit >= 0
                            ? "text-[color:var(--tf-green)]"
                            : "text-[color:var(--tf-red)]"
                        }
                      >
                        {fmt(row.netProfit)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="border-b border-border last:border-0 bg-muted/20">
                    <td colSpan={9} className="px-4 py-4">
                      {isLoading || !breakdown ? (
                        <p className="text-xs text-muted-foreground">Cargando desglose...</p>
                      ) : (
                        <MonthBreakdownDetail breakdown={breakdown} />
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
        <tfoot className="bg-muted/50 border-t border-border">
          <tr>
            <td className="px-4 py-3 font-bold text-[13px]">Total</td>
            <td className="px-4 py-3 text-right font-bold text-[13px]">{fmt(totals.salesRevenue)}</td>
            <td className="px-4 py-3 text-right font-bold text-[13px] text-[color:var(--tf-accent)]">
              {fmt(totals.interestIncome)}
            </td>
            <td className="px-4 py-3 text-right font-bold text-[13px]">{fmt(totals.otherIncome)}</td>
            <td className="px-4 py-3 text-right font-bold text-[13px]">{fmt(totals.totalIncome)}</td>
            <td className="px-4 py-3 text-right font-bold text-[13px]">{fmt(totals.cost)}</td>
            <td className="px-4 py-3 text-right font-bold text-[13px] text-[color:var(--tf-green)]">
              {fmt(totals.grossProfit)}
            </td>
            <td className="px-4 py-3 text-right font-bold text-[13px]">{fmt(totals.expenses)}</td>
            <td
              className={`px-4 py-3 text-right font-bold text-[13px] ${
                totals.netProfit >= 0
                  ? "text-[color:var(--tf-green)]"
                  : "text-[color:var(--tf-red)]"
              }`}
            >
              {fmt(totals.netProfit)}
            </td>
          </tr>
        </tfoot>
      </table>
      </div>
    </>
  );
}

function MobileStat({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: number;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-[color:var(--tf-fg-subtle)]">{label}</dt>
      <dd
        className={`mono tabular-nums whitespace-nowrap ${valueClassName ?? "text-foreground"}`}
      >
        {value !== 0 ? fmt(value) : "—"}
      </dd>
    </div>
  );
}

function MonthBreakdownDetail({ breakdown }: { breakdown: MonthlyProfitBreakdown }) {
  const { sales, expenses, interestPayments, otherIncome } = breakdown;

  return (
    <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">
      <BreakdownSection title={`Ventas (${sales.length})`}>
        {sales.length === 0 ? (
          <EmptyRow />
        ) : (
          sales.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 py-1 text-[12px]">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {s.quantity > 1 && (
                    <span className="mono mr-1 text-[color:var(--tf-fg-subtle)]">
                      {s.quantity}×
                    </span>
                  )}
                  {s.productName}
                </p>
                <p className="truncate text-[color:var(--tf-fg-subtle)]">
                  {s.customerName || "Cliente sin registrar"} · {fmtDate(s.createdAt)}
                </p>
              </div>
              <div className="text-right whitespace-nowrap">
                <p className="mono font-medium tabular-nums">{fmt(s.price)}</p>
                <p className="mono tabular-nums text-[color:var(--tf-fg-subtle)]">
                  costo {fmt(s.cost)}
                </p>
              </div>
            </div>
          ))
        )}
      </BreakdownSection>

      <BreakdownSection title={`Gastos (${expenses.length})`}>
        {expenses.length === 0 ? (
          <EmptyRow />
        ) : (
          expenses.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-2 py-1 text-[12px]">
              <div className="min-w-0">
                <p className="truncate font-medium">{e.description}</p>
                <p className="truncate text-[color:var(--tf-fg-subtle)]">
                  {e.categoryName} · {fmtDate(e.date)}
                </p>
              </div>
              <p className="text-[color:var(--tf-red)] whitespace-nowrap">-{fmt(e.amount)}</p>
            </div>
          ))
        )}
      </BreakdownSection>

      <BreakdownSection title={`Intereses (${interestPayments.length})`}>
        {interestPayments.length === 0 ? (
          <EmptyRow />
        ) : (
          interestPayments.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 py-1 text-[12px]">
              <div className="min-w-0">
                <p className="truncate font-medium">{p.customerName || "Cliente sin registrar"}</p>
                <p className="truncate text-[color:var(--tf-fg-subtle)]">
                  {p.type} · {fmtDate(p.createdAt)}
                </p>
              </div>
              <p className="text-[color:var(--tf-accent)] whitespace-nowrap">
                +{fmt(p.interestPortion)}
              </p>
            </div>
          ))
        )}
      </BreakdownSection>

      <BreakdownSection title={`Otros ingresos (${otherIncome.length})`}>
        {otherIncome.length === 0 ? (
          <EmptyRow />
        ) : (
          otherIncome.map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-2 py-1 text-[12px]">
              <div className="min-w-0">
                <p className="truncate font-medium">{o.description}</p>
                <p className="truncate text-[color:var(--tf-fg-subtle)]">
                  {o.concept} · {fmtDate(o.date)}
                </p>
              </div>
              <p className="text-[color:var(--tf-green)] whitespace-nowrap">+{fmt(o.amount)}</p>
            </div>
          ))
        )}
      </BreakdownSection>
    </div>
  );
}

function BreakdownSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--tf-fg-subtle)]">
        {title}
      </p>
      {/*
        El scroll interno sólo aplica desde sm: dentro del scroll de la página
        un contenedor scrolleable de 224px atrapa el gesto en el teléfono.
      */}
      <div className="divide-y divide-border/60 sm:max-h-56 sm:overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

function EmptyRow() {
  return <p className="py-1 text-[12px] text-[color:var(--tf-fg-subtle)]">Sin registros</p>;
}
