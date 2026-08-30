"use client";

import { ShoppingCart, CalendarClock } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WarrantyStatusBadge } from "@/components/garantias/warranty-status-badge";
import { formatWarrantyDate, formatDocumentNumber } from "@/lib/warranty/format";
import type { WarrantySearchRow } from "@/services/warranty-service";

interface WarrantyResultsTableProps {
  rows: WarrantySearchRow[];
  onSelect: (row: WarrantySearchRow) => void;
}

export function WarrantyResultsTable({
  rows,
  onSelect,
}: WarrantyResultsTableProps) {
  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead>IMEI / Serial</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Origen</TableHead>
            <TableHead>Entrega</TableHead>
            <TableHead>Vence</TableHead>
            <TableHead className="text-right">Garantía</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.key}
              onClick={() => onSelect(row)}
              className="cursor-pointer"
            >
              <TableCell className="font-medium">{row.productName}</TableCell>
              <TableCell className="font-mono text-[12.5px]">
                {row.serialNumber ?? (
                  <span className="text-muted-foreground italic font-sans">
                    Sin serial
                  </span>
                )}
              </TableCell>
              <TableCell>
                {row.customerName ?? (
                  <span className="text-muted-foreground">Sin registrar</span>
                )}
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1.5 text-[13px]">
                  {row.sourceType === "sale" ? (
                    <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  {formatDocumentNumber(row.sourceId)}
                </span>
              </TableCell>
              <TableCell>{formatWarrantyDate(row.startDate)}</TableCell>
              <TableCell>
                {formatWarrantyDate(row.expiryDate)}
                <span className="text-muted-foreground text-[12px]">
                  {" "}
                  ({row.warrantyMonths}m)
                </span>
              </TableCell>
              <TableCell className="text-right">
                <WarrantyStatusBadge status={row.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
