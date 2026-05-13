"use client";

import * as React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Search,
  Receipt,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { getCashMovementsAction } from "@/app/actions/cash-actions";
import { CashAccountWithBalance } from "@/services/cash-service";
import { formatCurrency } from "@/lib/formatters";

type MovementRow = NonNullable<Awaited<ReturnType<typeof getCashMovementsAction>>["data"]>[number];

const SOURCE_LABELS: Record<string, string> = {
  sale_payment: "Venta",
  layaway_deposit: "Apartado",
  expense: "Gasto",
  import_cost: "Importación",
  transfer: "Transferencia",
  adjustment: "Ajuste",
  opening_balance: "Saldo inicial",
  owner_payout: "Pago propietario",
  refund: "Devolución",
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  card: "Tarjeta",
  wallet: "Billetera",
};

const columns: ColumnDef<MovementRow>[] = [
  {
    accessorKey: "occurredAt",
    header: "Fecha",
    cell: ({ row }) => {
      const date = new Date(row.original.occurredAt);
      return (
        <span className="text-[13px] text-foreground tabular-nums whitespace-nowrap">
          {date.toLocaleDateString("es-CO", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </span>
      );
    },
  },
  {
    accessorKey: "accountName",
    header: "Cuenta",
    cell: ({ row }) => (
      <span className="text-[13px] text-foreground">{row.original.accountName}</span>
    ),
  },
  {
    accessorKey: "direction",
    header: "Tipo",
    cell: ({ row }) => {
      const isIn = row.original.direction === "in";
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11.5px] font-semibold whitespace-nowrap"
          style={
            isIn
              ? {
                  background: "oklch(0.62 0.15 150 / 0.12)",
                  color: "oklch(0.55 0.15 150)",
                }
              : {
                  background: "oklch(0.6 0.2 25 / 0.1)",
                  color: "oklch(0.55 0.18 25)",
                }
          }
        >
          {isIn ? (
            <ArrowDownLeft className="h-3 w-3" />
          ) : (
            <ArrowUpRight className="h-3 w-3" />
          )}
          {isIn ? "Ingreso" : "Egreso"}
        </span>
      );
    },
  },
  {
    accessorKey: "sourceType",
    header: "Origen",
    cell: ({ row }) => {
      const src = row.original.sourceType;
      return (
        <span className="text-[13px] text-foreground">
          {SOURCE_LABELS[src] ?? src}
        </span>
      );
    },
  },
  {
    accessorKey: "amount",
    header: () => <span className="block w-full text-right">Monto</span>,
    cell: ({ row }) => {
      const isIn = row.original.direction === "in";
      return (
        <div
          className="text-right font-mono text-[13px] font-semibold"
          style={{
            color: isIn ? "var(--tf-green)" : "var(--tf-red)",
          }}
        >
          {isIn ? "+" : "-"}
          {formatCurrency(parseFloat(row.original.amount))}
        </div>
      );
    },
  },
  {
    accessorKey: "paymentMethod",
    header: "Método",
    cell: ({ row }) => {
      const method = row.original.paymentMethod;
      return (
        <span className="text-[13px] text-muted-foreground">
          {method ? (PAYMENT_LABELS[method] ?? method) : "—"}
        </span>
      );
    },
  },
  {
    accessorKey: "referenceCode",
    header: "Referencia",
    cell: ({ row }) => (
      <span className="font-mono text-[12.5px] text-muted-foreground">
        {row.original.referenceCode ?? "—"}
      </span>
    ),
  },
];

export function CashMovementsTable({
  accounts,
}: {
  accounts: CashAccountWithBalance[];
}) {
  const [movements, setMovements] = React.useState<MovementRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedAccountId, setSelectedAccountId] =
    React.useState<string>("all");
  const [globalFilter, setGlobalFilter] = React.useState("");

  const loadMovements = React.useCallback(async () => {
    setLoading(true);
    try {
      if (selectedAccountId === "all") {
        const results = await Promise.all(
          accounts.map((a) => getCashMovementsAction(a.id, 100)),
        );
        const all = results.flatMap((r) => r.data ?? []);
        all.sort(
          (a, b) =>
            new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
        );
        setMovements(all.slice(0, 100));
      } else {
        const result = await getCashMovementsAction(selectedAccountId, 100);
        setMovements(result.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId, accounts]);

  React.useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  const table = useReactTable({
    data: movements,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    initialState: { pagination: { pageSize: 15 } },
  });

  const totalFiltered = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize } = table.getState().pagination;
  const from = totalFiltered === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min((pageIndex + 1) * pageSize, totalFiltered);

  return (
    <div
      className="bg-card border border-border rounded-[10px]"
      style={{ boxShadow: "var(--tf-shadow-sm)" }}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border rounded-[10px_10px_0_0] bg-muted/30 flex-wrap">
        <div className="flex items-center gap-2">
          <h3 className="text-[14px] font-semibold text-foreground">
            Movimientos
          </h3>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-muted border border-border text-[11px] font-semibold text-muted-foreground tabular-nums">
            {totalFiltered}
          </span>
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {/* Account filter */}
          <Select
            value={selectedAccountId}
            onValueChange={setSelectedAccountId}
          >
            <SelectTrigger className="h-8 w-[160px] text-[13px]">
              <SelectValue placeholder="Todas las cuentas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las cuentas</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Global search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-8 h-8 w-[180px] text-[13px]"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-[0_0_10px_10px] overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border">
                {table.getHeaderGroups().map((hg) =>
                  hg.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="px-4 py-3 text-[11.5px] uppercase tracking-wide font-semibold text-muted-foreground whitespace-nowrap"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  )),
                )}
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border">
              {loading ? (
                // Skeleton rows
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`} className="border-border/60">
                    {columns.map((col, j) => (
                      <TableCell key={j} className="px-4 py-3">
                        <div className="h-4 rounded bg-muted animate-pulse" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row, i) => (
                  <TableRow
                    key={row.id}
                    className="tf-row-enter hover:bg-muted/50 border-border/60 transition-colors"
                    style={{ animationDelay: `${i * 18}ms` }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="px-4 py-3">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length}>
                    <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                      <Receipt className="h-8 w-8 opacity-30" />
                      <p className="text-[13px] font-medium">
                        No hay movimientos registrados
                      </p>
                      <p className="text-[12px] opacity-70">
                        Los movimientos aparecerán aquí cuando existan
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {!loading && totalFiltered > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-card">
            <span className="text-[12.5px] text-muted-foreground tabular-nums">
              Mostrando{" "}
              <b className="text-foreground">{from}</b>–
              <b className="text-foreground">{to}</b>
              {" de "}
              <b className="text-foreground">{totalFiltered}</b>
            </span>
            <div className="flex items-center gap-1">
              <button
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[6px] text-[12.5px] border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Anterior
              </button>
              <button
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[6px] text-[12.5px] border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Siguiente
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
