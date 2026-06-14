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
import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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

export const columns: ColumnDef<Expense>[] = [
  {
    accessorKey: "date",
    header: "Fecha",
    meta: { mobileLabel: "Fecha" },
    cell: ({ row }) => {
      return format(new Date(row.getValue("date")), "PPP", { locale: es });
    },
  },
  {
    accessorKey: "description",
    header: "Descripción",
    meta: { mobileLabel: "Descripción" },
  },
  {
    accessorKey: "categoryName",
    header: "Categoría",
    meta: { mobileLabel: "Categoría" },
    cell: ({ row }) => row.getValue("categoryName") || "Sin categoría",
  },
  {
    accessorKey: "userName",
    header: "Usuario",
    meta: { mobileLabel: "Usuario" },
    cell: ({ row }) => row.getValue("userName") || "Desconocido",
  },
  {
    accessorKey: "paymentMethod",
    header: "Método",
    meta: { mobileLabel: "Método" },
    cell: ({ row }) => {
      const method = row.getValue("paymentMethod") as string;
      const map: Record<string, string> = {
        cash: "Efectivo",
        transfer: "Transferencia",
        card: "Tarjeta",
      };
      return map[method] || method;
    },
  },
  {
    accessorKey: "amount",
    header: "Monto",
    meta: { mobileLabel: "Monto" },
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("amount"));
      const formatted = new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
      }).format(amount);

      return <div className="font-medium">{formatted}</div>;
    },
  },
];

export function ExpensesTable({ data }: ExpensesTableProps) {
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(), // Client-side filtering
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center py-4">
        <Input
          placeholder="Filtrar gastos..."
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
                  No hay resultados.
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
    </div>
  );
}
