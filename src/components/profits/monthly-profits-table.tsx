import type { MonthlyProfit } from "@/services/profits-service";

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

interface MonthlyProfitsTableProps {
  data: MonthlyProfit[];
}

export function MonthlyProfitsTable({ data }: MonthlyProfitsTableProps) {
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
          {data.map((row) => (
            <tr
              key={row.month}
              className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
            >
              <td className="px-4 py-3 font-medium text-[13px]">
                {MONTH_NAMES[row.month - 1]}
              </td>
              <td className="px-4 py-3 text-right text-[13px] text-muted-foreground">
                {row.revenue > 0 ? fmt(row.revenue) : "—"}
              </td>
              <td className="px-4 py-3 text-right text-[13px] text-muted-foreground">
                {row.cost > 0 ? fmt(row.cost) : "—"}
              </td>
              <td className="px-4 py-3 text-right text-[13px] font-medium">
                {row.grossProfit > 0 ? (
                  <span className="text-green-600">{fmt(row.grossProfit)}</span>
                ) : row.grossProfit < 0 ? (
                  <span className="text-red-600">{fmt(row.grossProfit)}</span>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3 text-right text-[13px] text-blue-600">
                {row.interestIncome > 0 ? fmt(row.interestIncome) : "—"}
              </td>
              <td className="px-4 py-3 text-right text-[13px] text-muted-foreground">
                {row.expenses > 0 ? fmt(row.expenses) : "—"}
              </td>
              <td className="px-4 py-3 text-right text-[13px] font-semibold">
                {row.netProfit !== 0 ? (
                  <span className={row.netProfit >= 0 ? "text-green-600" : "text-red-600"}>
                    {fmt(row.netProfit)}
                  </span>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-muted/50 border-t border-border">
          <tr>
            <td className="px-4 py-3 font-bold text-[13px]">Total</td>
            <td className="px-4 py-3 text-right font-bold text-[13px]">{fmt(totals.revenue)}</td>
            <td className="px-4 py-3 text-right font-bold text-[13px]">{fmt(totals.cost)}</td>
            <td className="px-4 py-3 text-right font-bold text-[13px] text-green-600">
              {fmt(totals.grossProfit)}
            </td>
            <td className="px-4 py-3 text-right font-bold text-[13px] text-blue-600">{fmt(totals.interestIncome)}</td>
            <td className="px-4 py-3 text-right font-bold text-[13px]">{fmt(totals.expenses)}</td>
            <td className={`px-4 py-3 text-right font-bold text-[13px] ${totals.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
              {fmt(totals.netProfit)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
