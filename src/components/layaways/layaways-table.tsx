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
import { Input } from "@/components/ui/input";
import { Eye, HandCoins, XCircle, Clock, Search, X } from "lucide-react";
import { useState, useMemo } from "react";
import { LayawayDetailsDialog } from "./layaway-details-dialog";
import { LayawayPaymentDialog } from "./layaway-payment-dialog";
import { cancelLayawayAction } from "@/app/actions/layaway-actions";
import { toast } from "sonner";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";

interface Layaway {
  id: string;
  status: string;
  totalAmount: number;
  expiresAt: Date;
  createdAt: Date;
  customerName: string | null;
  customerDocument: string | null;
  customerPhone: string | null;
  totalPaid: number;
  balance: number;
}

interface CashAccount {
  id: string;
  name: string;
}

interface LayawaysTableProps {
  data: Layaway[];
  accounts: CashAccount[];
}

function getEffectiveStatus(layaway: Layaway): string {
  if (layaway.status === "completed" || layaway.balance <= 0) return "completed";
  if (layaway.status === "cancelled") return "cancelled";
  if (new Date(layaway.expiresAt) < new Date()) return "overdue";
  return "active";
}

export function LayawaysTable({ data, accounts }: LayawaysTableProps) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [selectedLayaway, setSelectedLayaway] = useState<Layaway | null>(null);

  const handleCancel = async () => {
    if (!selectedLayaway) return;
    const res = await cancelLayawayAction(selectedLayaway.id);
    if (res.success) {
      toast.success("Apartado cancelado. El inventario ha sido liberado.");
      setCancelOpen(false);
    } else {
      toast.error(res.error || "Error al cancelar el apartado");
    }
  };

  const columns = useMemo<ColumnDef<Layaway>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "Fecha",
        cell: ({ row }) =>
          new Date(row.getValue("createdAt")).toLocaleDateString("es-ES"),
      },
      {
        accessorKey: "customerName",
        header: "Cliente",
        cell: ({ row }) => {
          const layaway = row.original;
          return (
            <div>
              <div className="font-medium">
                {layaway.customerName || "Sin Nombre"}
              </div>
              <div className="text-xs text-muted-foreground">
                {layaway.customerDocument}
                {layaway.customerPhone ? ` • ${layaway.customerPhone}` : ""}
              </div>
            </div>
          );
        },
      },
      {
        id: "effectiveStatus",
        header: "Estado",
        cell: ({ row }) => (
          <StatusBadge status={getEffectiveStatus(row.original)} />
        ),
      },
      {
        accessorKey: "expiresAt",
        header: "Vencimiento",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {new Date(row.getValue("expiresAt")).toLocaleDateString("es-ES")}
          </span>
        ),
      },
      {
        accessorKey: "totalAmount",
        header: "Total",
        cell: ({ row }) => (
          <div className="text-right font-medium">
            {formatCurrency(row.getValue("totalAmount"))}
          </div>
        ),
      },
      {
        accessorKey: "totalPaid",
        header: "Abonado",
        cell: ({ row }) => (
          <div className="text-right text-muted-foreground">
            {formatCurrency(row.getValue("totalPaid"))}
          </div>
        ),
      },
      {
        accessorKey: "balance",
        header: "Saldo",
        cell: ({ row }) => (
          <div className="text-right font-bold text-primary">
            {formatCurrency(row.getValue("balance"))}
          </div>
        ),
      },
      {
        id: "actions",
        header: "Acciones",
        cell: ({ row }) => {
          const layaway = row.original;
          return (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2"
                aria-label="Ver detalles del apartado"
                onClick={() => {
                  setSelectedLayaway(layaway);
                  setDetailsOpen(true);
                }}
              >
                <Eye className="h-4 w-4 mr-1" /> Detalles
              </Button>
              {layaway.status === "active" && layaway.balance > 0 && (
                <Button
                  variant="default"
                  size="sm"
                  className="h-8 px-2"
                  aria-label="Registrar abono"
                  onClick={() => {
                    setSelectedLayaway(layaway);
                    setPaymentOpen(true);
                  }}
                >
                  <HandCoins className="h-4 w-4 mr-1" /> Abonar
                </Button>
              )}
              {layaway.status === "active" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  aria-label="Cancelar apartado"
                  onClick={() => {
                    setSelectedLayaway(layaway);
                    setCancelOpen(true);
                  }}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [],
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
  });

  const filteredCount = table.getFilteredRowModel().rows.length;
  const totalCount = data.length;

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Filtrar apartados..."
              value={globalFilter ?? ""}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-9 pr-9"
            />
            {globalFilter && (
              <button
                onClick={() => setGlobalFilter("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpiar filtro"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {globalFilter
              ? `${filteredCount} de ${totalCount} resultados`
              : `${totalCount} registros`}
          </span>
        </div>

        <div className="w-full">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
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
                  <TableCell colSpan={columns.length} className="p-0">
                    <EmptyState
                      icon={Clock}
                      headline={
                        globalFilter
                          ? "No se encontraron apartados con ese filtro"
                          : "No hay apartados registrados"
                      }
                      description={
                        globalFilter
                          ? "Intenta con un término diferente"
                          : "Los apartados aparecerán aquí cuando se creen desde el POS"
                      }
                      className="border-0"
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-end gap-2">
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

      <LayawayDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        layawayId={selectedLayaway?.id || null}
        customerName={selectedLayaway?.customerName || null}
      />

      <LayawayPaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        layawayId={selectedLayaway?.id || null}
        balance={selectedLayaway?.balance || 0}
        onSuccess={() => setPaymentOpen(false)}
        accounts={accounts}
      />

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Está seguro de cancelar este apartado?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción es irreversible. Los productos reservados volverán a
              estar disponibles en el inventario para ser vendidos a otros
              clientes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar Cancelación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
