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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Eye } from "lucide-react";
import { SaleDetailsModal } from "./sale-details-modal";

interface Sale {
  id: string;
  totalAmount: string;
  status: string;
  date: Date;
  userName: string | null;
}

interface SalesTableProps {
  data: Sale[];
}

export function SalesTable({ data }: SalesTableProps) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenDetails = (saleId: string) => {
    setSelectedSaleId(saleId);
    setIsModalOpen(true);
  };

  const columns = useMemo<ColumnDef<Sale>[]>(
    () => [
      {
        accessorKey: "date",
        header: "Fecha",
        meta: { mobileLabel: "Fecha" },
        cell: ({ row }) => {
          return format(new Date(row.getValue("date")), "PPP p", {
            locale: es,
          });
        },
      },
      {
        accessorKey: "id",
        header: "ID Venta",
        meta: { mobileLabel: "ID" },
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.getValue("id")}</span>
        ),
      },
      {
        accessorKey: "userName",
        header: "Vendedor",
        meta: { mobileLabel: "Vendedor" },
        cell: ({ row }) => row.getValue("userName") || "Sistema",
      },
      {
        accessorKey: "status",
        header: "Estado",
        meta: { mobileLabel: "Estado" },
        cell: ({ row }) => {
          const status = row.getValue("status") as string;
          return (
            <span
              className={`capitalize ${status === "completed" ? "text-green-600" : "text-yellow-600"}`}
            >
              {status === "completed" ? "Completada" : status}
            </span>
          );
        },
      },
      {
        accessorKey: "totalAmount",
        header: "Total",
        meta: { mobileLabel: "Total" },
        cell: ({ row }) => {
          const amount = parseFloat(row.getValue("totalAmount"));
          const formatted = new Intl.NumberFormat("es-CO", {
            style: "currency",
            currency: "COP",
          }).format(amount);

          return <div className="font-medium">{formatted}</div>;
        },
      },
      {
        id: "actions",
        header: "Acciones",
        meta: { mobileLabel: "" },
        cell: ({ row }) => {
          return (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleOpenDetails(row.original.id)}
            >
              <Eye className="h-4 w-4" />
            </Button>
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
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center py-4">
        <Input
          placeholder="Filtrar ventas..."
          value={globalFilter ?? ""}
          onChange={(event) => setGlobalFilter(event.target.value)}
          className="max-w-sm"
        />
      </div>
      <div className="w-full">
        <Table mobileCards>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      data-label={cell.column.columnDef.meta?.mobileLabel ?? ""}
                    >
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
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No hay ventas registradas.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
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

      <SaleDetailsModal
        saleId={selectedSaleId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
