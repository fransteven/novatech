"use client";

import {
  ColumnDef,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getFilteredRowModel,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchField } from "@/components/ui/search-field";
import { TablePagination } from "@/components/ui/table-pagination";
import { Fragment, useMemo, useRef, useState } from "react";
import { ChevronRight, Receipt } from "lucide-react";
import { SaleDetailsModal } from "./sale-details-modal";
import { formatCurrency, formatNumberCO, formatPercentCO } from "@/lib/formatters";
import {
  dayKey,
  dayLabel,
  dayTotals,
  groupByDay,
  timeLabel,
} from "@/lib/ledger-days";
import { cn } from "@/lib/utils";
import type { SaleListItem } from "@/services/sales-service";

interface SalesTableProps {
  data: SaleListItem[];
}

const PAGE_SIZE = 25;

const shortId = (id: string) => id.slice(0, 8).toUpperCase();

/** Sin líneas no hay costo confiable: la utilidad se omite en vez de inflarla. */
const saleProfit = (sale: SaleListItem) => {
  if (sale.status !== "completed" || sale.lineCount === 0) return null;
  const total = Number(sale.totalAmount);
  const profit = total - Number(sale.totalCost);
  return { profit, rate: total > 0 ? profit / total : 0 };
};

const profitTone = (profit: number) =>
  profit >= 0 ? "text-[color:var(--tf-green)]" : "text-[color:var(--tf-red)]";

const STATUS_LABELS: Record<string, { label: string; className?: string }> = {
  cancelled: { label: "Anulada", className: "tf-badge-out" },
  pending: { label: "Pendiente", className: "tf-badge-low" },
};

const SaleStatus = ({ status }: { status: string }) => {
  if (status === "completed") return <Badge variant="outline" className="tf-badge-normal h-5 px-1.5 text-[10px]">Completada</Badge>;
  const config = STATUS_LABELS[status] ?? { label: status };
  return (
    <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", config.className)}>
      {config.label}
    </Badge>
  );
};

const ExtraLines = ({ count }: { count: number }) =>
  count > 0 ? (
    <span className="mono shrink-0 rounded-sm bg-muted px-1 py-px text-[10px] font-semibold text-muted-foreground">
      +{count}
    </span>
  ) : null;

const DayHeading = ({ date }: { date: Date }) => {
  const label = dayLabel(date);
  return (
    <span className="flex items-baseline gap-2">
      {label.relative ? (
        <span className="text-[12px] font-semibold text-foreground">
          {label.relative}
        </span>
      ) : null}
      <span
        className={cn(
          "text-[12px] first-letter:uppercase",
          label.relative ? "text-muted-foreground" : "font-semibold text-foreground",
        )}
      >
        {label.date}
      </span>
    </span>
  );
};

const DayRowLabel = ({ date, count }: { date: Date; count: number }) => (
  <span className="flex items-baseline gap-3">
    <DayHeading date={date} />
    <span className="mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--tf-fg-subtle)]">
      {count} {count === 1 ? "venta" : "ventas"}
    </span>
  </span>
);

const columns: ColumnDef<SaleListItem>[] = [
  {
    // La tabla se pinta a mano; esta columna sólo alimenta la búsqueda global.
    id: "search",
    accessorFn: (sale) =>
      [
        sale.productNames,
        sale.customerName,
        sale.userName,
        sale.id,
        dayLabel(sale.date).date,
      ]
        .filter(Boolean)
        .join(" "),
  },
];

export function SalesTable({ data }: SalesTableProps) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const handleOpenDetails = (saleId: string) => {
    setSelectedSaleId(saleId);
    setIsModalOpen(true);
  };

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: { pagination: { pageSize: PAGE_SIZE } },
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
  });

  const filteredRows = table.getFilteredRowModel().rows;
  const pageSales = table.getRowModel().rows.map((row) => row.original);

  const summary = useMemo(() => {
    let total = 0;
    let profit = 0;
    for (const { original } of filteredRows) {
      if (original.status === "completed") total += Number(original.totalAmount);
      profit += saleProfit(original)?.profit ?? 0;
    }
    return { count: filteredRows.length, total, profit };
  }, [filteredRows]);

  const totalsByDay = useMemo(
    () =>
      dayTotals(
        filteredRows.map((row) => row.original),
        (sale) => sale.date,
        (sale) => sale.status === "completed" ? Number(sale.totalAmount) : 0,
      ),
    [filteredRows],
  );

  const profitByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const { original } of filteredRows) {
      const key = dayKey(original.date);
      map.set(key, (map.get(key) ?? 0) + (saleProfit(original)?.profit ?? 0));
    }
    return map;
  }, [filteredRows]);

  const groups = groupByDay(pageSales, (sale) => sale.date);
  const isFiltering = globalFilter.trim().length > 0;
  const activeSaleId = isModalOpen ? selectedSaleId : null;

  const scrollToList = () =>
    listRef.current?.scrollIntoView({ block: "start" });

  return (
    <div ref={listRef} className="scroll-mt-20 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchField
          searchId="sales-search"
          searchLabel="Buscar ventas"
          placeholder="Producto, cliente, vendedor o ID"
          value={globalFilter ?? ""}
          onChange={(event) => setGlobalFilter(event.target.value)}
          onClear={() => setGlobalFilter("")}
          className="w-full sm:w-80"
        />
        <dl
          aria-live="polite"
          className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] gap-px overflow-hidden rounded-[8px] border border-border bg-border sm:flex sm:gap-0 sm:border-0 sm:bg-transparent"
        >
          <SummaryStat
            label={isFiltering ? "Coinciden" : "Ventas"}
            value={formatNumberCO(summary.count)}
          />
          <SummaryStat label="Total" value={formatCurrency(summary.total)} />
          <SummaryStat
            label="Utilidad"
            value={formatCurrency(summary.profit)}
            valueClassName={profitTone(summary.profit)}
          />
        </dl>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={Receipt}
          headline={isFiltering ? "Ninguna venta coincide" : "Aún no hay ventas"}
          description={
            isFiltering
              ? `No hay resultados para «${globalFilter.trim()}».`
              : "Las ventas del POS aparecerán aquí agrupadas por día."
          }
          action={
            isFiltering
              ? { label: "Limpiar búsqueda", onClick: () => setGlobalFilter("") }
              : undefined
          }
        />
      ) : (
        <>
          {/* Escritorio: libro por día; los subtotales caen bajo su columna. */}
          <div className="hidden md:block">
            <Table density="compact" className="min-w-[900px] table-fixed">
              <colgroup>
                <col className="w-[9%]" />
                <col className="w-[27%] lg:w-[25%]" />
                <col className="w-[19%] lg:w-[17%]" />
                <col className="hidden lg:table-column lg:w-[15%]" />
                <col className="w-[16%] lg:w-[14%]" />
                <col className="w-[23%] lg:w-[16%]" />
                <col className="w-[6%] lg:w-[4%]" />
              </colgroup>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Hora</TableHead>
                  <TableHead>Venta</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden lg:table-cell">Vendedor</TableHead>
                  <TableHead className="text-right">Utilidad</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>
                    <span className="sr-only">Detalle</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group) => {
                  const day = totalsByDay.get(group.key);
                  const dayProfit = profitByDay.get(group.key) ?? 0;
                  return (
                    <Fragment key={group.key}>
                      <TableRow className="bg-muted/35 hover:bg-muted/35">
                        {/* Vendedor se oculta bajo lg: el rótulo ocupa una columna menos. */}
                        <TableCell colSpan={3} className="py-2 lg:hidden">
                          <DayRowLabel date={group.date} count={day?.count ?? 0} />
                        </TableCell>
                        <TableCell colSpan={4} className="hidden py-2 lg:table-cell">
                          <DayRowLabel date={group.date} count={day?.count ?? 0} />
                        </TableCell>
                        <TableCell
                          className={cn(
                            "mono py-2 text-right text-[12px] font-medium tabular-nums",
                            profitTone(dayProfit),
                          )}
                        >
                          {formatCurrency(dayProfit)}
                        </TableCell>
                        <TableCell className="mono py-2 text-right text-[12px] font-semibold tabular-nums text-[color:var(--tf-green)]">
                          {formatCurrency(day?.total ?? 0)}
                        </TableCell>
                        <TableCell className="py-2" />
                      </TableRow>

                      {group.items.map((sale) => {
                        const profit = saleProfit(sale);
                        const isActive = activeSaleId === sale.id;
                        return (
                          <TableRow
                            key={sale.id}
                            data-state={isActive ? "selected" : undefined}
                            onClick={() => handleOpenDetails(sale.id)}
                            className="cursor-pointer"
                          >
                            <TableCell
                              className={cn(
                                "mono text-[12px] text-muted-foreground",
                                isActive && "tf-trace-rail",
                              )}
                            >
                              {timeLabel(sale.date)}
                            </TableCell>
                            <TableCell className="min-w-0 whitespace-normal">
                              <div className="flex min-w-0 items-start gap-1.5">
                                <span
                                  className="line-clamp-2 min-w-0 font-medium leading-snug"
                                  title={sale.productNames ?? undefined}
                                >
                                  {sale.leadProductName ?? "Venta sin detalle"}
                                </span>
                                <ExtraLines count={sale.lineCount - 1} />
                                <SaleStatus status={sale.status} />
                              </div>
                              <p className="mono mt-0.5 text-[10px] text-[color:var(--tf-fg-subtle)]">
                                #{shortId(sale.id)}
                                {sale.unitCount > 1 ? ` · ${sale.unitCount} uds` : ""}
                              </p>
                            </TableCell>
                            <TableCell className="min-w-0">
                              {sale.customerName ? <span className="block truncate">{sale.customerName}</span> : (
                                <span className="text-muted-foreground">Sin cliente</span>
                              )}
                            </TableCell>
                            <TableCell className="hidden text-muted-foreground lg:table-cell">
                              <span className="block truncate">{sale.userName ?? "Sistema"}</span>
                            </TableCell>
                            <TableCell className="text-right">
                              {profit ? (
                                <>
                                  <span
                                    className={cn(
                                      "mono block text-[13px] tabular-nums",
                                      profitTone(profit.profit),
                                    )}
                                  >
                                    {formatCurrency(profit.profit)}
                                  </span>
                                  <span className="mono block text-[10px] text-[color:var(--tf-fg-subtle)]">
                                    {formatPercentCO(profit.rate)}
                                  </span>
                                </>
                              ) : (
                                <span className="text-[color:var(--tf-fg-subtle)]">—</span>
                              )}
                            </TableCell>
                            <TableCell className={cn("mono text-right text-[14px] font-semibold tabular-nums", sale.status === "completed" ? "text-[color:var(--tf-green)]" : sale.status === "cancelled" ? "text-[color:var(--tf-red)]" : "text-[color:var(--tf-amber)]")}>
                              {formatCurrency(sale.totalAmount)}
                            </TableCell>
                            <TableCell className="pr-2 text-right">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Ver detalle de la venta ${shortId(sale.id)}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleOpenDetails(sale.id);
                                }}
                              >
                                <ChevronRight className="text-muted-foreground" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Móvil: tarjeta por venta con producto y total como titular. */}
          <div className="space-y-5 md:hidden">
            {groups.map((group) => {
              const day = totalsByDay.get(group.key);
              return (
                <section key={group.key} aria-label={dayLabel(group.date).date}>
                  <header className="mb-2 flex items-baseline justify-between gap-3 px-1">
                    <DayHeading date={group.date} />
                    <span className="mono text-[11px] text-muted-foreground">
                      {day?.count ?? 0} ·{" "}
                      <span className="font-semibold text-foreground">
                        {formatCurrency(day?.total ?? 0)}
                      </span>
                    </span>
                  </header>
                  <ul className="space-y-2">
                    {group.items.map((sale) => {
                      const profit = saleProfit(sale);
                      return (
                        <li key={sale.id}>
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(sale.id)}
                            className={cn(
                              "w-full rounded-[10px] border border-border bg-card px-4 py-3 text-left transition-colors duration-[140ms] active:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              activeSaleId === sale.id &&
                                "tf-trace-rail border-[var(--tf-border-strong)]",
                            )}
                          >
                            <span className="flex items-start justify-between gap-3">
                              <span className="flex min-w-0 items-start gap-1.5">
                                <span className="line-clamp-2 text-[14px] font-medium leading-snug">
                                  {sale.leadProductName ?? "Venta sin detalle"}
                                </span>
                                <ExtraLines count={sale.lineCount - 1} />
                              </span>
                              <span className={cn("mono shrink-0 text-[15px] font-semibold tabular-nums leading-snug", sale.status === "completed" ? "text-[color:var(--tf-green)]" : sale.status === "cancelled" ? "text-[color:var(--tf-red)]" : "text-[color:var(--tf-amber)]")}>
                                {formatCurrency(sale.totalAmount)}
                              </span>
                            </span>
                            <span className="mt-1 flex items-center justify-between gap-3 text-[12px]">
                              <span className="flex min-w-0 items-center gap-1.5">
                                <span
                                  className={cn(
                                    "truncate",
                                    sale.customerName ? "text-foreground/80" : "text-muted-foreground",
                                  )}
                                >
                                  {sale.customerName ?? "Sin cliente"}
                                </span>
                                <SaleStatus status={sale.status} />
                              </span>
                              {profit ? (
                                <span
                                  className={cn(
                                    "mono shrink-0 text-[11px] tabular-nums",
                                    profitTone(profit.profit),
                                  )}
                                >
                                  Util. {formatCurrency(profit.profit)}
                                </span>
                              ) : null}
                            </span>
                            <span className="mono mt-2 block truncate text-[10px] uppercase tracking-[0.06em] text-[color:var(--tf-fg-subtle)]">
                              {timeLabel(sale.date)} · #{shortId(sale.id)} ·{" "}
                              {sale.userName ?? "Sistema"}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        </>
      )}

      <TablePagination table={table} onPageChange={scrollToList} />

      <SaleDetailsModal
        saleId={selectedSaleId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}

const SummaryStat = ({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) => (
  <div className="bg-card px-3 py-2 sm:bg-transparent sm:px-0 sm:py-0 sm:pl-5 sm:text-right">
    <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--tf-fg-subtle)]">
      {label}
    </dt>
    <dd
      className={cn(
        "mono truncate text-[13px] font-semibold tabular-nums",
        valueClassName,
      )}
    >
      {value}
    </dd>
  </div>
);
