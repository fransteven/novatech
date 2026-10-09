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
import { EmptyState } from "@/components/ui/empty-state";
import { SearchField } from "@/components/ui/search-field";
import { TablePagination } from "@/components/ui/table-pagination";
import { Fragment, useMemo, useRef, useState } from "react";
import {
  ArrowLeftRight,
  Banknote,
  CreditCard,
  ReceiptText,
  type LucideIcon,
} from "lucide-react";
import { formatCurrency, formatNumberCO } from "@/lib/formatters";
import { dayLabel, dayTotals, groupByDay } from "@/lib/ledger-days";
import { cn } from "@/lib/utils";

interface Expense {
  id: string;
  amount: string;
  description: string;
  date: Date;
  paymentMethod: string;
  categoryName: string | null;
  userName: string | null;
}

interface ExpensesTableProps {
  data: Expense[];
}

const PAGE_SIZE = 25;
const NO_CATEGORY = "Sin categoría";

const PAYMENT_METHODS: Record<string, { label: string; icon: LucideIcon }> = {
  cash: { label: "Efectivo", icon: Banknote },
  transfer: { label: "Transferencia", icon: ArrowLeftRight },
  card: { label: "Tarjeta", icon: CreditCard },
};

const paymentLabel = (method: string) => PAYMENT_METHODS[method]?.label ?? method;

const PaymentMethod = ({ method, className }: { method: string; className?: string }) => {
  const config = PAYMENT_METHODS[method];
  const Icon = config?.icon ?? Banknote;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <Icon className="size-3.5 shrink-0 text-[color:var(--tf-fg-subtle)]" aria-hidden />
      {config?.label ?? method}
    </span>
  );
};

const CategoryTag = ({ name }: { name: string | null }) => (
  <span
    className={cn(
      "inline-flex max-w-full items-center truncate rounded-sm border border-border bg-muted/50 px-1.5 py-px text-[11px] font-medium",
      !name && "text-muted-foreground",
    )}
  >
    {name ?? NO_CATEGORY}
  </span>
);

const DayHeading = ({ date, count }: { date: Date; count: number }) => {
  const label = dayLabel(date);
  return (
    <span className="flex items-baseline gap-2">
      {label.relative ? (
        <span className="text-[12px] font-semibold">{label.relative}</span>
      ) : null}
      <span
        className={cn(
          "text-[12px] first-letter:uppercase",
          label.relative ? "text-muted-foreground" : "font-semibold",
        )}
      >
        {label.date}
      </span>
      <span className="mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--tf-fg-subtle)]">
        {count} {count === 1 ? "gasto" : "gastos"}
      </span>
    </span>
  );
};

const columns: ColumnDef<Expense>[] = [
  {
    // La tabla se pinta a mano; esta columna sólo alimenta la búsqueda global.
    id: "search",
    accessorFn: (expense) =>
      [
        expense.description,
        expense.categoryName ?? NO_CATEGORY,
        expense.userName,
        paymentLabel(expense.paymentMethod),
        dayLabel(expense.date).date,
      ]
        .filter(Boolean)
        .join(" "),
  },
];

export function ExpensesTable({ data }: ExpensesTableProps) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Categorías ordenadas por peso en el gasto: las que más pesan van primero.
  const categories = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const expense of data) {
      const name = expense.categoryName ?? NO_CATEGORY;
      const current = map.get(name) ?? { count: 0, total: 0 };
      current.count += 1;
      current.total += Number(expense.amount);
      map.set(name, current);
    }
    return [...map.entries()]
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.total - a.total);
  }, [data]);

  const scopedData = useMemo(
    () =>
      category
        ? data.filter((expense) => (expense.categoryName ?? NO_CATEGORY) === category)
        : data,
    [data, category],
  );

  const table = useReactTable({
    data: scopedData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: { pagination: { pageSize: PAGE_SIZE } },
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
  });

  const filteredRows = table.getFilteredRowModel().rows;
  const pageExpenses = table.getRowModel().rows.map((row) => row.original);

  const summary = useMemo(() => {
    let total = 0;
    for (const { original } of filteredRows) total += Number(original.amount);
    return { count: filteredRows.length, total };
  }, [filteredRows]);

  const totalsByDay = useMemo(
    () =>
      dayTotals(
        filteredRows.map((row) => row.original),
        (expense) => expense.date,
        (expense) => Number(expense.amount),
      ),
    [filteredRows],
  );

  const groups = groupByDay(pageExpenses, (expense) => expense.date);
  const isFiltering = globalFilter.trim().length > 0 || category !== null;

  const clearFilters = () => {
    setGlobalFilter("");
    setCategory(null);
  };

  const scrollToList = () =>
    listRef.current?.scrollIntoView({ block: "start" });

  return (
    <div ref={listRef} className="scroll-mt-20 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchField
          searchId="expenses-search"
          searchLabel="Buscar gastos"
          placeholder="Descripción, categoría o usuario"
          value={globalFilter ?? ""}
          onChange={(event) => setGlobalFilter(event.target.value)}
          onClear={() => setGlobalFilter("")}
          className="w-full sm:w-80"
        />
        <dl
          aria-live="polite"
          className="grid grid-cols-[auto_minmax(0,1fr)] gap-px overflow-hidden rounded-[8px] border border-border bg-border sm:flex sm:gap-0 sm:border-0 sm:bg-transparent"
        >
          <SummaryStat
            label={isFiltering ? "Coinciden" : "Gastos"}
            value={formatNumberCO(summary.count)}
          />
          <SummaryStat label="Total" value={formatCurrency(summary.total)} />
        </dl>
      </div>

      {categories.length > 1 ? (
        <div
          role="group"
          aria-label="Filtrar por categoría"
          className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
        >
          <CategoryChip
            label="Todas"
            count={data.length}
            active={category === null}
            onClick={() => setCategory(null)}
          />
          {categories.map((item) => (
            <CategoryChip
              key={item.name}
              label={item.name}
              count={item.count}
              active={category === item.name}
              onClick={() => setCategory(category === item.name ? null : item.name)}
            />
          ))}
        </div>
      ) : null}

      {groups.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          headline={isFiltering ? "Ningún gasto coincide" : "Aún no hay gastos"}
          description={
            isFiltering
              ? "Prueba con otra búsqueda o categoría."
              : "Registra el primer gasto con el botón Nuevo gasto."
          }
          action={
            isFiltering ? { label: "Limpiar filtros", onClick: clearFilters } : undefined
          }
        />
      ) : (
        <>
          {/* Escritorio: libro por día con el subtotal bajo la columna Monto. */}
          <div className="hidden md:block">
            <Table density="compact">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Descripción</TableHead>
                  <TableHead className="w-[180px]">Categoría</TableHead>
                  <TableHead className="w-[150px]">Método</TableHead>
                  <TableHead className="hidden w-[160px] lg:table-cell">Registró</TableHead>
                  <TableHead className="w-[140px] text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group) => {
                  const day = totalsByDay.get(group.key);
                  return (
                    <Fragment key={group.key}>
                      <TableRow className="bg-muted/35 hover:bg-muted/35">
                        {/* Registró se oculta bajo lg: el rótulo ocupa una columna menos. */}
                        <TableCell colSpan={3} className="py-2 lg:hidden">
                          <DayHeading date={group.date} count={day?.count ?? 0} />
                        </TableCell>
                        <TableCell colSpan={4} className="hidden py-2 lg:table-cell">
                          <DayHeading date={group.date} count={day?.count ?? 0} />
                        </TableCell>
                        <TableCell className="mono py-2 text-right text-[12px] font-semibold tabular-nums">
                          {formatCurrency(day?.total ?? 0)}
                        </TableCell>
                      </TableRow>
                      {group.items.map((expense) => (
                        <TableRow key={expense.id}>
                          <TableCell className="max-w-[420px] whitespace-normal">
                            <span className="line-clamp-2 leading-snug">
                              {expense.description}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-[180px]">
                            <CategoryTag name={expense.categoryName} />
                          </TableCell>
                          <TableCell className="text-[13px] text-muted-foreground">
                            <PaymentMethod method={expense.paymentMethod} />
                          </TableCell>
                          <TableCell className="hidden max-w-[160px] truncate text-[13px] text-muted-foreground lg:table-cell">
                            {expense.userName ?? "Desconocido"}
                          </TableCell>
                          <TableCell className="mono text-right text-[14px] font-semibold tabular-nums">
                            {formatCurrency(expense.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Móvil: tarjeta por gasto con descripción y monto como titular. */}
          <div className="space-y-5 md:hidden">
            {groups.map((group) => {
              const day = totalsByDay.get(group.key);
              const label = dayLabel(group.date);
              return (
                <section key={group.key} aria-label={label.date}>
                  <header className="mb-2 flex items-baseline justify-between gap-3 px-1">
                    <span className="flex items-baseline gap-2">
                      {label.relative ? (
                        <span className="text-[12px] font-semibold">{label.relative}</span>
                      ) : null}
                      <span
                        className={cn(
                          "text-[12px] first-letter:uppercase",
                          label.relative ? "text-muted-foreground" : "font-semibold",
                        )}
                      >
                        {label.date}
                      </span>
                    </span>
                    <span className="mono text-[11px] text-muted-foreground">
                      {day?.count ?? 0} ·{" "}
                      <span className="font-semibold text-foreground">
                        {formatCurrency(day?.total ?? 0)}
                      </span>
                    </span>
                  </header>
                  <ul className="space-y-2">
                    {group.items.map((expense) => (
                      <li
                        key={expense.id}
                        className="rounded-[10px] border border-border bg-card px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="line-clamp-2 min-w-0 text-[14px] font-medium leading-snug">
                            {expense.description}
                          </p>
                          <p className="mono shrink-0 text-[15px] font-semibold tabular-nums leading-snug">
                            {formatCurrency(expense.amount)}
                          </p>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3 text-[12px]">
                          <span className="min-w-0">
                            <CategoryTag name={expense.categoryName} />
                          </span>
                          <PaymentMethod
                            method={expense.paymentMethod}
                            className="shrink-0 text-muted-foreground"
                          />
                        </div>
                        <p className="mono mt-2 truncate text-[10px] uppercase tracking-[0.06em] text-[color:var(--tf-fg-subtle)]">
                          Registró {expense.userName ?? "Desconocido"}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </>
      )}

      <TablePagination table={table} onPageChange={scrollToList} />
    </div>
  );
}

const CategoryChip = ({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={cn(
      "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium transition-colors duration-[140ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:h-10",
      active
        ? "border-[var(--tf-accent)] bg-[var(--tf-accent-soft)] text-foreground"
        : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
    )}
  >
    {label}
    <span className="mono text-[10px] text-[color:var(--tf-fg-subtle)]">{count}</span>
  </button>
);

const SummaryStat = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-card px-3 py-2 sm:bg-transparent sm:px-0 sm:py-0 sm:pl-5 sm:text-right">
    <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--tf-fg-subtle)]">
      {label}
    </dt>
    <dd className="mono truncate text-[13px] font-semibold tabular-nums">{value}</dd>
  </div>
);
