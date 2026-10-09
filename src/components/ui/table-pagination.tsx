"use client";

import type { Table } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumberCO } from "@/lib/formatters";

interface TablePaginationProps<T> {
  table: Table<T>;
  /** Tras cambiar de página, p. ej. para volver al inicio del listado. */
  onPageChange?: () => void;
}

export const TablePagination = <T,>({ table, onPageChange }: TablePaginationProps<T>) => {
  const { pageIndex, pageSize } = table.getState().pagination;
  const total = table.getFilteredRowModel().rows.length;
  const pageCount = table.getPageCount();
  if (total === 0) return null;

  const from = pageIndex * pageSize + 1;
  const to = Math.min(total, from + pageSize - 1);

  return (
    <nav
      aria-label="Paginación"
      className="flex items-center justify-between gap-3"
    >
      <p className="mono text-[11px] text-[color:var(--tf-fg-subtle)]">
        {formatNumberCO(from)}–{formatNumberCO(to)}{" "}
        <span className="text-muted-foreground">de</span>{" "}
        {formatNumberCO(total)}
      </p>
      {pageCount > 1 ? (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => {
              table.previousPage();
              onPageChange?.();
            }}
            disabled={!table.getCanPreviousPage()}
            aria-label="Página anterior"
          >
            <ChevronLeft />
          </Button>
          <span className="mono min-w-14 text-center text-[11px] tabular-nums text-muted-foreground">
            {pageIndex + 1} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => {
              table.nextPage();
              onPageChange?.();
            }}
            disabled={!table.getCanNextPage()}
            aria-label="Página siguiente"
          >
            <ChevronRight />
          </Button>
        </div>
      ) : null}
    </nav>
  );
};
