"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
  ColumnFiltersState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Package,
  Download,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  X,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductDetailSheet } from "./product-detail-sheet";
import { formatCurrency } from "@/lib/formatters";
import { EmptyState } from "@/components/ui/empty-state";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    className?: string;
    mobileLabel?: string;
  }
}

interface StockItem {
  productId: string;
  productName: string | null;
  sku: string | null;
  isSerialized: boolean;
  attributes: unknown;
  stockTotal: number;
  avgCost: number;
  status: string;
}

interface StockTableProps {
  stock: StockItem[];
  searchSlot?: React.ReactNode;
}

type StockStatus = "normal" | "low" | "out";

function StatusBadge({ status, stock }: { status: string; stock: number }) {
  const s: StockStatus = stock <= 0 ? "out" : status === "low" ? "low" : "normal";
  const labelMap = { normal: "Normal", low: "Bajo", out: "Agotado" };
  const hasPulse = s === "low" || s === "out";

  return (
    <span className={`inline-flex items-center gap-[6px] px-[9px] py-[3px] text-[11.5px] font-semibold rounded-full ${
      s === "normal" ? "tf-badge-normal" : s === "low" ? "tf-badge-low" : "tf-badge-out"
    }`}>
      {hasPulse
        ? <span className="tf-pulse-dot" />
        : <span className="w-[6px] h-[6px] rounded-full bg-current" />
      }
      {labelMap[s]}
    </span>
  );
}

function StatusFilterDropdown({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const options = [
    { id: "normal", label: "Normal", color: "var(--tf-green)" },
    { id: "low",    label: "Bajo",   color: "var(--tf-amber)" },
    { id: "out",    label: "Agotado",color: "var(--tf-red)" },
  ];

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-2 h-9 px-3 rounded-lg border text-[13px] font-medium text-foreground transition-colors duration-150",
          open
            ? "border-primary bg-card shadow-[0_0_0_4px_var(--tf-accent-ring)]"
            : "border-[color:var(--tf-border-strong)] bg-card hover:bg-muted",
        )}
      >
        <Filter className="h-3.5 w-3.5" />
        <span>Estado</span>
        {selected.length > 0 && (
          <span className="text-[10.5px] font-semibold px-[6px] py-px rounded-full bg-primary text-primary-foreground">
            {selected.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute top-[calc(100%+6px)] left-0 min-w-[220px] bg-card border border-border rounded-[10px] p-[6px] z-50"
          style={{ boxShadow: "var(--tf-shadow-lg)", animation: "tf-menu-in 180ms cubic-bezier(.4,0,.2,1)" }}
          role="listbox"
        >
          {options.map((opt) => {
            const isSel = selected.includes(opt.id);
            return (
              <button
                key={opt.id}
                className="flex items-center gap-[10px] w-full px-[10px] py-2 rounded-[7px] text-[13px] text-foreground hover:bg-muted transition-colors duration-100 text-left"
                data-selected={isSel || undefined}
                onClick={() => toggle(opt.id)}
              >
                <span
                  className="w-4 h-4 rounded grid place-items-center shrink-0 border-[1.5px] transition-colors"
                  style={isSel ? { background: "var(--tf-accent)", borderColor: "var(--tf-accent)", color: "var(--tf-accent-fg)" } : { borderColor: "var(--tf-border-strong)" }}
                >
                  {isSel && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: opt.color }} />
                <span>{opt.label}</span>
              </button>
            );
          })}
          {selected.length > 0 && (
            <>
              <div className="h-px bg-border my-1" />
              <button
                className="flex items-center gap-[10px] w-full px-[10px] py-2 rounded-[7px] text-[13px] text-foreground hover:bg-muted transition-colors duration-100 text-left"
                onClick={() => onChange([])}
              >
                <span className="w-4 h-4 rounded grid place-items-center shrink-0 border border-[color:var(--tf-border-strong)]">
                  <X className="h-3 w-3" strokeWidth={3} />
                </span>
                <span>Limpiar selección</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function StockTable({ stock = [], searchSlot }: StockTableProps) {
  const [selectedProduct, setSelectedProduct] = useState<StockItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  const filteredByStatus = useMemo(() => {
    if (!statusFilter.length) return stock;
    return stock.filter((item) => {
      const s = item.stockTotal <= 0 ? "out" : item.status === "low" ? "low" : "normal";
      return statusFilter.includes(s);
    });
  }, [stock, statusFilter]);

  const columns = useMemo<ColumnDef<StockItem>[]>(
    () => [
      {
        accessorKey: "sku",
        header: "Código / SKU",
        meta: { className: "w-[140px]", mobileLabel: "SKU" },
        cell: ({ row }) => (
          <span className="mono text-[12.5px] text-[color:var(--tf-fg-muted)]">
            {row.original.sku || "—"}
          </span>
        ),
      },
      {
        accessorKey: "productName",
        header: "Producto",
        meta: { mobileLabel: "Producto" },
        cell: ({ row }) => {
          const item = row.original;
          const attrs = item.attributes as Record<string, string> | null;
          const sub = attrs ? Object.values(attrs).filter(Boolean).join(" · ") : "";
          const initials = (item.productName ?? "?")
            .split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
          return (
            <div className="flex items-center gap-3 min-w-[220px]">
              <div className="w-9 h-9 rounded-lg bg-muted border border-border grid place-items-center shrink-0 text-[14px] font-semibold text-[color:var(--tf-fg-subtle)]">
                {initials || <Package className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex flex-col leading-[1.35]">
                <span className="text-[13.5px] font-semibold text-foreground whitespace-nowrap overflow-hidden text-ellipsis max-w-[260px]">
                  {item.productName || "N/A"}
                </span>
                {sub && (
                  <span className="text-[12px] text-[color:var(--tf-fg-subtle)] whitespace-nowrap overflow-hidden text-ellipsis max-w-[260px] mt-px">
                    {sub}
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "stockTotal",
        header: "Stock",
        meta: { className: "w-[160px]", mobileLabel: "Stock" },
        cell: ({ row }) => {
          const qty = row.getValue("stockTotal") as number;
          const s: StockStatus = qty <= 0 ? "out" : row.original.status === "low" ? "low" : "normal";
          const pct = Math.min(100, (qty / Math.max(qty * 2, 50)) * 100);
          const barColor =
            s === "normal" ? "var(--tf-green)" : s === "low" ? "var(--tf-amber)" : "var(--tf-red)";
          return (
            <div className="flex items-center gap-[10px]">
              <span className="mono font-semibold min-w-[30px]" style={{ fontFeatureSettings: '"tnum"' }}>
                {qty}
              </span>
              <div className="w-16 h-[5px] rounded-full overflow-hidden shrink-0" style={{ background: "var(--tf-bg-muted)" }}>
                <div
                  className="h-full rounded-full transition-[width] duration-[400ms] ease-[cubic-bezier(.4,0,.2,1)]"
                  style={{ width: `${pct}%`, background: barColor }}
                />
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Estado",
        meta: { className: "w-[110px]", mobileLabel: "Estado" },
        cell: ({ row }) => (
          <StatusBadge status={row.getValue("status")} stock={row.original.stockTotal} />
        ),
      },
      {
        accessorKey: "avgCost",
        header: "Costo Prom.",
        meta: { className: "w-[120px] hidden md:table-cell", mobileLabel: "Costo Prom." },
        cell: ({ row }) => (
          <span className="mono text-[13px] font-medium">{formatCurrency(row.getValue("avgCost"))}</span>
        ),
      },
      {
        id: "actions",
        meta: { className: "w-[50px]", mobileLabel: "" },
        header: () => <span className="sr-only">Acciones</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <button
              title="Ver detalle"
              aria-label={`Ver detalle de ${row.original.productName}`}
              className="w-[30px] h-[30px] rounded-[7px] grid place-items-center text-[color:var(--tf-fg-subtle)] hover:bg-card hover:text-foreground hover:border hover:border-border transition-colors duration-100"
              onClick={() => { setSelectedProduct(row.original); setDetailOpen(true); }}
            >
              <Package className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: filteredByStatus,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { globalFilter, sorting, columnFilters },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    initialState: { pagination: { pageSize: 8 } },
  });

  const { pageIndex } = table.getState().pagination;
  const pageSize = 8;
  const totalFiltered = table.getFilteredRowModel().rows.length;
  const from = totalFiltered === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min((pageIndex + 1) * pageSize, totalFiltered);
  const totalPages = table.getPageCount();

  const pageNumbers = useMemo(() => {
    const nums: (number | "…")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) nums.push(i);
    } else {
      nums.push(1);
      if (pageIndex + 1 > 3) nums.push("…");
      for (let i = Math.max(2, pageIndex); i <= Math.min(totalPages - 1, pageIndex + 2); i++) nums.push(i);
      if (pageIndex + 1 < totalPages - 2) nums.push("…");
      nums.push(totalPages);
    }
    return nums;
  }, [pageIndex, totalPages]);

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-[10px] px-3 py-3 bg-card border border-border rounded-[10px_10px_0_0] flex-wrap">
        {searchSlot ?? null}

        <StatusFilterDropdown selected={statusFilter} onChange={setStatusFilter} />

        <div className="w-px h-6 bg-border" />

        <button className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-[color:var(--tf-border-strong)] bg-card text-[13px] font-medium text-foreground hover:bg-muted transition-colors duration-150">
          <Download className="h-3.5 w-3.5" />
          Exportar
        </button>

        <span className="text-[12.5px] text-[color:var(--tf-fg-subtle)] ml-auto" style={{ fontFeatureSettings: '"tnum"' }}>
          Mostrando <b className="text-foreground">{totalFiltered === 0 ? 0 : `${from}–${to}`}</b> de {totalFiltered}
        </span>
      </div>

      {/* Table */}
      <div className="bg-card border border-border border-t-0 rounded-[0_0_10px_10px] overflow-hidden">
        <div className="md:overflow-x-auto">
          <Table mobileCards className="w-full" style={{ fontSize: "13.5px", borderCollapse: "collapse" }}>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted border-b border-border">
                {table.getHeaderGroups().map((hg) =>
                  hg.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const sorted = header.column.getIsSorted();
                    return (
                      <TableHead
                        key={header.id}
                        className={cn(
                          "px-4 py-3 text-[12px] font-medium text-[color:var(--tf-fg-muted)] uppercase tracking-[0.02em] whitespace-nowrap select-none",
                          canSort && "cursor-pointer hover:text-foreground",
                          header.column.columnDef.meta?.className,
                          header.id === "actions" ? "text-right" : "",
                        )}
                        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      >
                        <span className="inline-flex items-center gap-1">
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort && (
                            <span className={cn("opacity-0 transition-opacity", sorted && "opacity-100")}>
                              {sorted === "asc" ? <ChevronUp className="h-[11px] w-[11px]" /> : <ChevronDown className="h-[11px] w-[11px]" />}
                            </span>
                          )}
                        </span>
                      </TableHead>
                    );
                  }),
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row, i) => (
                  <TableRow
                    key={row.id}
                    className="tf-row-enter border-b border-border last:border-0 hover:bg-muted/50 transition-colors duration-100"
                    style={{ animationDelay: `${i * 18}ms` }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn("px-4 py-[14px] align-middle", cell.column.columnDef.meta?.className)}
                        data-label={cell.column.columnDef.meta?.mobileLabel ?? ""}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="p-0">
                    <EmptyState
                      icon={Package}
                      headline="No hay productos en el inventario"
                      description="Agrega stock para ver los productos aquí"
                      className="border-0"
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalFiltered > 0 && (
          <div className="flex items-center justify-between px-5 py-[14px] border-t border-border bg-card">
            <div className="text-[12.5px] text-[color:var(--tf-fg-muted)]" style={{ fontFeatureSettings: '"tnum"' }}>
              Página <b className="text-foreground">{pageIndex + 1}</b> de {totalPages} · {totalFiltered} productos
            </div>
            <div className="flex items-center gap-1">
              <button
                className="h-8 w-8 rounded-[7px] grid place-items-center text-[color:var(--tf-fg-muted)] hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-100"
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.setPageIndex(0)}
                aria-label="Primera"
              >
                <ChevronsLeft className="h-3.5 w-3.5" />
              </button>
              <button
                className="inline-flex items-center gap-1 h-8 px-2 rounded-[7px] text-[12.5px] font-medium text-[color:var(--tf-fg-muted)] hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-100"
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.previousPage()}
                aria-label="Anterior"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Anterior
              </button>

              {pageNumbers.map((n, i) =>
                n === "…" ? (
                  <span key={i} className="h-8 min-w-8 px-2 rounded-[7px] grid place-items-center text-[12.5px] text-[color:var(--tf-fg-muted)] pointer-events-none">
                    …
                  </span>
                ) : (
                  <button
                    key={i}
                    className={cn(
                      "h-8 min-w-8 px-2 rounded-[7px] text-[12.5px] font-medium transition-colors duration-100",
                      n === pageIndex + 1
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-[color:var(--tf-fg-muted)] hover:bg-muted hover:text-foreground",
                    )}
                    aria-current={n === pageIndex + 1 ? "page" : undefined}
                    onClick={() => table.setPageIndex((n as number) - 1)}
                  >
                    {n}
                  </button>
                ),
              )}

              <button
                className="inline-flex items-center gap-1 h-8 px-2 rounded-[7px] text-[12.5px] font-medium text-[color:var(--tf-fg-muted)] hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-100"
                disabled={!table.getCanNextPage()}
                onClick={() => table.nextPage()}
                aria-label="Siguiente"
              >
                Siguiente <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                className="h-8 w-8 rounded-[7px] grid place-items-center text-[color:var(--tf-fg-muted)] hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-100"
                disabled={!table.getCanNextPage()}
                onClick={() => table.setPageIndex(totalPages - 1)}
                aria-label="Última"
              >
                <ChevronsRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedProduct && (
        <ProductDetailSheet
          product={selectedProduct}
          open={detailOpen}
          onOpenChange={setDetailOpen}
        />
      )}
    </>
  );
}
