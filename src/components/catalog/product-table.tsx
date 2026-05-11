"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Package,
  Layers,
  Trash2,
  Search,
  Download,
  MoreHorizontal,
  Pencil,
  Copy,
  Archive,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    className?: string;
  }
}

import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProductWithStock } from "@/services/product-service";
import { toast } from "sonner";
import { EditProductDialog } from "./edit-product-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteProductAction } from "@/app/actions/product-actions";
import { EmptyState } from "@/components/ui/empty-state";

interface ProductTableProps {
  data: ProductWithStock[];
}

function categoryColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  return `oklch(0.65 0.16 ${hue})`;
}

export function ProductTable({ data }: ProductTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [tipoFilter, setTipoFilter] = React.useState<string[]>([]);

  const [editProduct, setEditProduct] = React.useState<ProductWithStock | null>(null);
  const [deleteProduct, setDeleteProduct] = React.useState<ProductWithStock | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const maxStock = React.useMemo(
    () => Math.max(...data.map((p) => p.stock || 0), 1),
    [data],
  );

  const columns: ColumnDef<ProductWithStock>[] = [
    {
      accessorKey: "name",
      header: "Producto",
      cell: ({ row }) => {
        const item = row.original;
        const catName = item.categoryName || "";
        const color = catName ? categoryColor(catName) : "oklch(0.65 0.12 260)";
        const initials = item.name.slice(0, 2).toUpperCase();
        const attrs = item.attributes as Record<string, string> | null;
        const attrValues = attrs ? Object.values(attrs).filter(Boolean) : [];
        const sub = item.description || attrValues.join(" · ");
        return (
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-[9px] flex items-center justify-center flex-shrink-0 text-[11px] font-bold leading-none"
              style={{
                background: `color-mix(in oklch, ${color} 15%, var(--tf-bg-muted))`,
                color,
                border: `1px solid color-mix(in oklch, ${color} 30%, var(--tf-border))`,
              }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold text-foreground truncate leading-tight">
                {item.name}
              </div>
              {sub && (
                <div className="text-[11.5px] text-muted-foreground truncate mt-0.5">
                  {sub}
                </div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "sku",
      header: "SKU",
      meta: { className: "hidden lg:table-cell" },
      cell: ({ row }) => {
        const sku = row.getValue("sku") as string | null;
        return (
          <span className="font-mono text-[12.5px] text-muted-foreground">
            {sku || "—"}
          </span>
        );
      },
    },
    {
      accessorKey: "categoryName",
      header: "Categoría",
      meta: { className: "hidden md:table-cell" },
      cell: ({ row }) => {
        const name = (row.getValue("categoryName") as string) || null;
        if (!name) {
          return (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted border border-border text-[12px] text-muted-foreground font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 flex-shrink-0" />
              Sin categoría
            </span>
          );
        }
        const color = categoryColor(name);
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted border border-border text-[12px] text-muted-foreground font-medium">
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: color }}
            />
            {name}
          </span>
        );
      },
    },
    {
      accessorKey: "isSerialized",
      header: "Tipo",
      meta: { className: "hidden md:table-cell" },
      filterFn: (row, _columnId, filterValue: string[]) => {
        if (!filterValue || filterValue.length === 0) return true;
        const val = row.getValue("isSerialized") ? "serialized" : "standard";
        return filterValue.includes(val);
      },
      cell: ({ row }) => {
        const isSerialized = row.getValue("isSerialized") as boolean;
        if (isSerialized) {
          return (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[6px] text-[11.5px] font-semibold whitespace-nowrap"
              style={{ background: "var(--tf-accent-soft)", color: "var(--tf-accent)" }}
            >
              <Package className="h-3 w-3" />
              Serializado
            </span>
          );
        }
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[6px] text-[11.5px] font-semibold whitespace-nowrap"
            style={{ background: "var(--tf-green-soft)", color: "var(--tf-green)" }}
          >
            <Layers className="h-3 w-3" />
            Estándar
          </span>
        );
      },
    },
    {
      accessorKey: "price",
      header: () => <span className="w-full text-right block">Precio</span>,
      meta: { className: "text-right" },
      cell: ({ row }) => {
        const price = parseFloat(row.getValue("price"));
        return (
          <div className="text-right font-mono font-semibold text-[13.5px] text-foreground">
            {formatCurrency(price)}
          </div>
        );
      },
    },
    {
      accessorKey: "stock",
      header: () => <span className="w-full text-right block">Stock</span>,
      meta: { className: "text-right hidden sm:table-cell" },
      cell: ({ row }) => {
        const stock = (row.getValue("stock") as number) || 0;
        const pct = Math.min(100, (stock / maxStock) * 100);
        const barColor =
          stock > 20
            ? "var(--tf-green)"
            : stock > 5
            ? "var(--tf-amber)"
            : "var(--tf-red)";
        return (
          <div className="flex flex-col items-end gap-1.5">
            <span className="font-mono text-[13px] font-semibold text-foreground">
              {stock}
            </span>
            <div
              className="w-14 h-1 rounded-full overflow-hidden"
              style={{ background: "var(--tf-bg-muted)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: barColor }}
              />
            </div>
          </div>
        );
      },
    },
    {
      id: "actions",
      meta: { className: "w-12" },
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }) => {
        const product = row.original;
        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="w-7 h-7 rounded-[6px] flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  aria-label="Acciones"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => setEditProduct(product)}>
                  <Pencil className="h-3.5 w-3.5 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => toast.info("Duplicar — próximamente")}
                >
                  <Copy className="h-3.5 w-3.5 mr-2" />
                  Duplicar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => toast.info("Archivar — próximamente")}
                >
                  <Archive className="h-3.5 w-3.5 mr-2" />
                  Archivar
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeleteProduct(product)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  const handleDelete = React.useCallback(async () => {
    if (!deleteProduct) return;
    setIsDeleting(true);
    try {
      const result = await deleteProductAction(deleteProduct.id);
      if (result.success) {
        toast.success(result.message || "Producto eliminado exitosamente");
      } else {
        toast.error(result.error || "No se pudo eliminar el producto");
      }
    } catch {
      toast.error("Ocurrió un error inesperado al intentar eliminar el producto");
    } finally {
      setIsDeleting(false);
      setDeleteProduct(null);
    }
  }, [deleteProduct]);

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    initialState: { pagination: { pageSize: 10 } },
  });

  React.useEffect(() => {
    const col = table.getColumn("isSerialized");
    if (!col) return;
    col.setFilterValue(tipoFilter.length > 0 ? tipoFilter : undefined);
  }, [tipoFilter, table]);

  const { pageIndex, pageSize } = table.getState().pagination;
  const filteredRows = table.getFilteredRowModel().rows;
  const totalFiltered = filteredRows.length;
  const from = totalFiltered === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min((pageIndex + 1) * pageSize, totalFiltered);
  const pageCount = table.getPageCount();

  const toggleTipo = (val: string) => {
    setTipoFilter((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val],
    );
  };

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 bg-card border border-border rounded-t-[14px] flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] h-9 px-3 bg-muted/50 border border-transparent rounded-[8px] tf-focus-ring transition-all duration-150">
          <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            placeholder="Buscar producto..."
            value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
            onChange={(e) => table.getColumn("name")?.setFilterValue(e.target.value)}
            className="flex-1 bg-transparent border-0 outline-none text-[13px] placeholder:text-muted-foreground/60"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex items-center gap-2 h-9 px-3 rounded-[8px] bg-card border border-input hover:bg-muted text-[13px] text-foreground transition-colors">
              Tipo
              {tipoFilter.length > 0 && (
                <span className="bg-primary text-primary-foreground rounded-full text-[10.5px] px-1.5 py-px font-semibold leading-none">
                  {tipoFilter.length}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuCheckboxItem
              checked={tipoFilter.includes("serialized")}
              onCheckedChange={() => toggleTipo("serialized")}
            >
              Serializado
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={tipoFilter.includes("standard")}
              onCheckedChange={() => toggleTipo("standard")}
            >
              Estándar
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="w-px h-6 bg-border" />

        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 text-[13px]"
          onClick={() => toast.info("Exportar — próximamente")}
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Exportar</span>
        </Button>

        <span className="text-[12.5px] text-muted-foreground ml-auto tabular-nums whitespace-nowrap">
          Mostrando{" "}
          <b className="text-foreground">{totalFiltered === 0 ? 0 : from}</b>
          {" – "}
          <b className="text-foreground">{to}</b>
          {" de "}
          <b className="text-foreground">{totalFiltered}</b>
        </span>
      </div>

      {/* Table */}
      <div
        className="bg-card border border-border border-t-0 rounded-b-[14px] overflow-hidden"
        style={{ boxShadow: "var(--tf-shadow-sm)" }}
      >
        <div className="overflow-x-auto">
          <Table className="w-full">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border">
                {table.getHeaderGroups().map((headerGroup) =>
                  headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.06em]",
                        header.column.columnDef.meta?.className,
                      )}
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
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row, i) => (
                  <TableRow
                    key={row.id}
                    className="tf-row-enter hover:bg-muted/50 transition-colors"
                    style={{ animationDelay: `${i * 22}ms` }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          "px-4 py-3",
                          cell.column.columnDef.meta?.className,
                        )}
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
                      headline="No hay productos en el catálogo"
                      description="Registra un nuevo producto para comenzar"
                      className="border-0"
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-border bg-card">
          <div className="text-[12.5px] text-muted-foreground">
            {totalFiltered === 0 ? (
              "Sin resultados"
            ) : (
              <>
                Mostrando{" "}
                <b className="text-foreground">{from}</b>–
                <b className="text-foreground">{to}</b>
                {" de "}
                <b className="text-foreground">{totalFiltered}</b>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              className="w-7 h-7 rounded-[6px] flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              aria-label="Primera página"
            >
              <ChevronFirst className="h-3.5 w-3.5" />
            </button>
            <button
              className="w-7 h-7 rounded-[6px] flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            {Array.from({ length: pageCount }, (_, i) => i).map((pageNum) => (
              <button
                key={pageNum}
                className={cn(
                  "w-7 h-7 rounded-[6px] text-[12.5px] transition-colors",
                  pageNum === pageIndex
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                onClick={() => table.setPageIndex(pageNum)}
              >
                {pageNum + 1}
              </button>
            ))}
            <button
              className="w-7 h-7 rounded-[6px] flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Página siguiente"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button
              className="w-7 h-7 rounded-[6px] flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
              onClick={() => table.setPageIndex(pageCount - 1)}
              disabled={!table.getCanNextPage()}
              aria-label="Última página"
            >
              <ChevronLast className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {editProduct && (
        <EditProductDialog
          product={editProduct as any}
          open={!!editProduct}
          onOpenChange={(open: boolean) => !open && setEditProduct(null)}
        />
      )}

      <AlertDialog
        open={!!deleteProduct}
        onOpenChange={(open: boolean) => !open && setDeleteProduct(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás completamente seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el producto{" "}
              <strong>{deleteProduct?.name}</strong> de forma permanente del catálogo.
              <br />
              <br />
              <strong>Atención:</strong> Si este producto tiene registro de entradas, salidas
              o stock (seriales) en el inventario, la eliminación será rechazada para mantener
              la integridad financiera del sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isDeleting}
            >
              {isDeleting ? "Eliminando..." : "Sí, Eliminar Producto"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
