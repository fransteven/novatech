"use client";

import {
  ColumnDef,
  flexRender,
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
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Eye, Plus, Search, X, HandCoins } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreateCreditorDialog } from "./create-creditor-dialog";
import { CreditorDetailDialog } from "./creditor-detail-dialog";
import { EmptyState } from "@/components/ui/empty-state";

interface Creditor {
  id: string;
  name: string;
  contactPhone: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  outstandingBalance: number;
  totalLent: number;
  totalPaid: number;
  loanCount: number;
}

interface CashAccount {
  id: string;
  name: string;
}

interface CreditorsTableProps {
  data: Creditor[];
  accounts: CashAccount[];
}

export function CreditorsTable({ data, accounts }: CreditorsTableProps) {
  const router = useRouter();
  const [globalFilter, setGlobalFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedCreditor, setSelectedCreditor] = useState<Creditor | null>(
    null
  );
  const [detailOpen, setDetailOpen] = useState(false);

  const columns: ColumnDef<Creditor>[] = [
    {
      accessorKey: "name",
      header: "Acreedor",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.name}</div>
          {row.original.contactPhone && (
            <div className="text-xs text-muted-foreground">
              {row.original.contactPhone}
            </div>
          )}
        </div>
      ),
    },
    {
      accessorKey: "outstandingBalance",
      header: "Saldo Adeudado",
      cell: ({ row }) => {
        const balance = row.original.outstandingBalance;
        return (
          <span
            className={
              balance > 0
                ? "font-semibold text-destructive"
                : "text-muted-foreground"
            }
          >
            {formatCurrency(balance)}
          </span>
        );
      },
    },
    {
      accessorKey: "totalLent",
      header: "Total Prestado",
      cell: ({ row }) => (
        <span className="text-primary font-medium">
          {formatCurrency(row.original.totalLent)}
        </span>
      ),
    },
    {
      accessorKey: "totalPaid",
      header: "Total Pagado",
      cell: ({ row }) => (
        <span className="text-green-600 dark:text-green-400">
          {formatCurrency(row.original.totalPaid)}
        </span>
      ),
    },
    {
      accessorKey: "loanCount",
      header: "Préstamos",
      cell: ({ row }) => (
        <Badge variant="secondary">{row.original.loanCount}</Badge>
      ),
    },
    {
      accessorKey: "isActive",
      header: "Estado",
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "default" : "outline"}>
          {row.original.isActive ? "Activo" : "Inactivo"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setSelectedCreditor(row.original);
            setDetailOpen(true);
          }}
        >
          <Eye className="h-4 w-4 mr-1" />
          Ver
        </Button>
      ),
    },
  ];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    initialState: { pagination: { pageSize: 15 } },
  });

  const handleSuccess = () => {
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar acreedor..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
          {globalFilter && (
            <button
              onClick={() => setGlobalFilter("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="ml-auto">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Acreedor
          </Button>
        </div>
      </div>

      {/* Table */}
      {data.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          headline="Sin acreedores registrados"
          description="Agrega el primer acreedor para empezar a llevar el control del capital externo."
          action={{ label: "Nuevo Acreedor", onClick: () => setCreateOpen(true) }}
        />
      ) : (
        <>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((h) => (
                      <TableHead key={h.id}>
                        {h.isPlaceholder
                          ? null
                          : flexRender(
                              h.column.columnDef.header,
                              h.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="text-center py-10 text-muted-foreground"
                    >
                      No hay resultados para la búsqueda.
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {table.getPageCount() > 1 && (
            <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
              <span>
                Página {table.getState().pagination.pageIndex + 1} de{" "}
                {table.getPageCount()}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Dialogs */}
      <CreateCreditorDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={handleSuccess}
      />

      {selectedCreditor && (
        <CreditorDetailDialog
          creditor={selectedCreditor}
          open={detailOpen}
          onOpenChange={(open) => {
            setDetailOpen(open);
            if (!open) setSelectedCreditor(null);
          }}
          accounts={accounts}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
