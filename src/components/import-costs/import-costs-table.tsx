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
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ImportCostRow {
  id: string;
  purchaseDate: Date;
  productName: string | null;
  specs: Record<string, string> | null;
  condition: string;
  provider: string | null;
  status: string;
  baseUsdCost: string;
  totalCostPesos: string;
  catalogPrice: string | null;
  mastercardDollarRate: string | null;
  mastercardCommissionPesos: string | null;
  casilleroPesos: string;
  productPesos: string;
  customsTariffPesos: string;
  productTrm: string;
  casilleroTrm: string;
  notes: string | null;
}

interface ImportCostsTableProps {
  data: ImportCostRow[];
}

const formatCOP = (value: string | null | undefined) => {
  if (!value) return "—";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(parseFloat(value));
};

const formatUSD = (value: string | null | undefined) => {
  if (!value) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(parseFloat(value));
};

const formatTrm = (value: string | null | undefined) => {
  if (!value || parseFloat(value) <= 0) return null;
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
  }).format(parseFloat(value));
};

const TrmLine = ({
  pesos,
  trm,
}: {
  pesos: string | null;
  trm: string | null;
}) => {
  if (!pesos || parseFloat(pesos) <= 0)
    return <span className="text-muted-foreground">—</span>;
  const trmFormatted = formatTrm(trm);
  return (
    <div className="leading-tight">
      <div className="font-medium">{formatCOP(pesos)}</div>
      {trmFormatted && (
        <div className="text-[11px] text-muted-foreground font-mono">
          @ {trmFormatted} / USD
        </div>
      )}
    </div>
  );
};

export const columns: ColumnDef<ImportCostRow>[] = [
  {
    accessorKey: "purchaseDate",
    header: "Fecha",
    cell: ({ row }) =>
      format(new Date(row.getValue("purchaseDate")), "dd MMM yyyy", {
        locale: es,
      }),
  },
  {
    accessorKey: "productName",
    header: "Dispositivo",
    cell: ({ row }) => {
      const name = row.getValue("productName") as string | null;
      const specs = row.original.specs;
      const specValues = specs ? Object.values(specs).filter(Boolean) : [];
      return (
        <div className="space-y-1">
          <span>{name || "—"}</span>
          {specValues.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {specValues.map((val) => (
                <Badge
                  key={val}
                  variant="secondary"
                  className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] py-0 px-1.5 font-medium"
                >
                  {val}
                </Badge>
              ))}
            </div>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "provider",
    header: "Proveedor",
    cell: ({ row }) => row.getValue("provider") || "—",
  },
  {
    accessorKey: "status",
    header: "Estado",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return (
        <Badge variant={status === "comprado" ? "default" : "secondary"}>
          {status === "comprado" ? "Comprado" : "Cotización"}
        </Badge>
      );
    },
  },
  {
    accessorKey: "baseUsdCost",
    header: "Costo producto",
    cell: ({ row }) => (
      <span className="font-mono text-sm">
        {formatUSD(row.getValue("baseUsdCost"))}
      </span>
    ),
  },
  {
    accessorKey: "mastercardCommissionPesos",
    header: "Comisión MC",
    cell: ({ row }) => (
      <TrmLine
        pesos={row.original.mastercardCommissionPesos}
        trm={row.original.mastercardDollarRate}
      />
    ),
  },
  {
    accessorKey: "productPesos",
    header: "Valor equipo",
    cell: ({ row }) => (
      <TrmLine
        pesos={row.original.productPesos}
        trm={row.original.productTrm}
      />
    ),
  },
  {
    accessorKey: "casilleroPesos",
    header: "Casillero",
    cell: ({ row }) => (
      <TrmLine
        pesos={row.original.casilleroPesos}
        trm={row.original.casilleroTrm}
      />
    ),
  },
  {
    accessorKey: "totalCostPesos",
    header: "Costo total",
    cell: ({ row }) => (
      <span className="font-semibold">
        {formatCOP(row.getValue("totalCostPesos"))}
      </span>
    ),
  },
];

export function ImportCostsTable({ data }: ImportCostsTableProps) {
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center py-4">
        <Input
          placeholder="Filtrar por dispositivo, proveedor..."
          value={globalFilter ?? ""}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-sm"
        />
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
            {table.getRowModel().rows?.length ? (
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
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No hay registros de importación.
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
