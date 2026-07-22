import { formatCurrency } from "@/lib/formatters";

interface Contribution {
  id: string;
  shareholderId: string;
  shareholderName: string;
  amount: string | number;
  notes: string | null;
  occurredAt: Date;
  createdAt: Date;
}

interface ContributionsTableProps {
  contributions: Contribution[];
}

export function ContributionsTable({ contributions }: ContributionsTableProps) {
  if (contributions.length === 0) {
    return (
      <div className="rounded-[12px] border border-border p-8 text-center text-muted-foreground text-[13px]">
        No hay aportes registrados aún.
      </div>
    );
  }

  return (
    <div className="rounded-[12px] border border-border overflow-x-auto">
      <table className="w-full text-sm min-w-[540px]">
        <thead className="bg-muted/50">
          <tr className="border-b border-border">
            <th className="px-4 py-3 text-left font-semibold text-[12px] uppercase tracking-wide text-muted-foreground">
              Fecha
            </th>
            <th className="px-4 py-3 text-left font-semibold text-[12px] uppercase tracking-wide text-muted-foreground">
              Accionista
            </th>
            <th className="px-4 py-3 text-right font-semibold text-[12px] uppercase tracking-wide text-muted-foreground">
              Monto
            </th>
            <th className="px-4 py-3 text-left font-semibold text-[12px] uppercase tracking-wide text-muted-foreground">
              Notas
            </th>
          </tr>
        </thead>
        <tbody>
          {contributions.map((c) => (
            <tr
              key={c.id}
              className="border-b border-border hover:bg-muted/30 transition-colors"
            >
              <td className="px-4 py-3 text-[13px] text-muted-foreground">
                {new Date(c.occurredAt).toLocaleDateString("es-CO")}
              </td>
              <td className="px-4 py-3 text-[13px] font-medium">
                {c.shareholderName}
              </td>
              <td className="px-4 py-3 text-right text-[13px] font-semibold text-green-600">
                {formatCurrency(Number(c.amount))}
              </td>
              <td className="px-4 py-3 text-[13px] text-muted-foreground">
                {c.notes ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
