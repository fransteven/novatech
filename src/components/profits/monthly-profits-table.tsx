"use client";

import { Fragment, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { MonthlyProfit, MonthlyProfitBreakdown } from "@/services/profits-service";
import { getMonthlyProfitBreakdownAction } from "@/app/actions/profits-actions";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const fmt = (amount: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(amount);

const fmtDate = (date: Date | string) =>
  new Date(date).toLocaleDateString("es-ES");

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
      revenue: acc.revenue + row.revenue,
      cost: acc.cost + row.cost,
      grossProfit: acc.grossProfit + row.grossProfit,
      expenses: acc.expenses + row.expenses,
      interestIncome: acc.interestIncome + row.interestIncome,
      netProfit: acc.netProfit + row.netProfit,
    }),
    { revenue: 0, cost: 0, grossProfit: 0, expenses: 0, interestIncome: 0, netProfit: 0 },
  );

  const hasData = (row: MonthlyProfit) =>
    row.revenue > 0 || row.cost > 0 || row.expenses > 0 || row.interestIncome > 0;

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

  return (
    <div className="rounded-[12px] border border-border overflow-x-auto">
      <table className="w-full text-sm min-w-[560px]">
        <thead className="bg-muted/50">
          <tr className="border-b border-border">
            <th className="px-4 py-3 text-left font-semibold text-[12px] uppercase tracking-wide text-[color:var(--tf-fg-subtle)]">
              Mes
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
              Intereses
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
                    {row.revenue > 0 ? fmt(row.revenue) : "—"}
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
                  <td className="px-4 py-3 text-right text-[13px] text-[color:var(--tf-accent)]">
                    {row.interestIncome > 0 ? fmt(row.interestIncome) : "—"}
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
                    <td colSpan={7} className="px-4 py-4">
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
            <td className="px-4 py-3 text-right font-bold text-[13px]">{fmt(totals.revenue)}</td>
            <td className="px-4 py-3 text-right font-bold text-[13px]">{fmt(totals.cost)}</td>
            <td className="px-4 py-3 text-right font-bold text-[13px] text-[color:var(--tf-green)]">
              {fmt(totals.grossProfit)}
            </td>
            <td className="px-4 py-3 text-right font-bold text-[13px] text-[color:var(--tf-accent)]">{fmt(totals.interestIncome)}</td>
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
  );
}

function MonthBreakdownDetail({ breakdown }: { breakdown: MonthlyProfitBreakdown }) {
  const { sales, expenses, interestPayments } = breakdown;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <BreakdownSection title={`Ventas (${sales.length})`}>
        {sales.length === 0 ? (
          <EmptyRow />
        ) : (
          sales.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 py-1 text-[12px]">
              <div className="min-w-0">
                <p className="truncate font-medium">{s.productName}</p>
                <p className="truncate text-[color:var(--tf-fg-subtle)]">
                  {s.customerName || "Cliente sin registrar"} · {fmtDate(s.createdAt)}
                </p>
              </div>
              <div className="text-right whitespace-nowrap">
                <p className="font-medium">{fmt(s.price)}</p>
                <p className="text-[color:var(--tf-fg-subtle)]">costo {fmt(s.unitCost)}</p>
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
    </div>
  );
}

function BreakdownSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--tf-fg-subtle)]">
        {title}
      </p>
      <div className="max-h-56 overflow-y-auto divide-y divide-border/60">{children}</div>
    </div>
  );
}

function EmptyRow() {
  return <p className="py-1 text-[12px] text-[color:var(--tf-fg-subtle)]">Sin registros</p>;
}
