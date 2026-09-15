"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { InventoryMovement } from "@/lib/validators/inventory-validator";
import { formatCurrency } from "@/lib/formatters";

interface InventoryMovementsTableProps {
  movements: InventoryMovement[];
}

export function InventoryMovementsTable({
  movements = [],
}: InventoryMovementsTableProps) {
  const getTypeBadge = (type: string) => {
    switch (type) {
      case "IN":
        return <Badge variant="default">Entrada</Badge>;
      case "OUT":
        return <Badge variant="secondary">Salida</Badge>;
      case "ADJUSTMENT":
        return <Badge variant="outline">Ajuste</Badge>;
      default:
        return <Badge>{type}</Badge>;
    }
  };

  return (
    <div className="w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-center">Cantidad</TableHead>
            <TableHead className="text-right">Costo Unitario</TableHead>
            <TableHead>Razón</TableHead>
            <TableHead>Fecha</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.length > 0 ? (
            movements.map((movement) => (
              <TableRow key={movement.id}>
                <TableCell className="font-medium">
                  <div>
                    {movement.productName || "N/A"}
                    {movement.serialNumber && (
                      <div className="text-xs text-muted-foreground font-mono">
                        S/N: {movement.serialNumber}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>{getTypeBadge(movement.type)}</TableCell>
                <TableCell className="text-center font-mono">
                  {movement.quantity}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {movement.unitCost
                    ? formatCurrency(movement.unitCost)
                    : "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {movement.reason || "—"}
                </TableCell>
                <TableCell className="text-sm">
                  {movement.createdAt
                    ? new Date(movement.createdAt).toLocaleDateString("es-ES", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center">
                No hay movimientos registrados.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
