"use client";

import { formatCurrency } from "@/lib/formatters";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShoppingCart } from "lucide-react";

export function PurchaseList({ purchases }: { purchases: { id: string; purchaseDate: Date | string; provider: { name: string } | null; invoiceNumber?: string | null; referenceCode?: string | null; paymentMethod: string; totalAmount: string | number }[] }) {
  if (purchases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-card border border-border rounded-lg shadow-sm">
        <ShoppingCart className="h-10 w-10 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No hay compras registradas</h3>
        <p className="text-sm text-muted-foreground mt-1">Registra tu primera compra para verla aquí.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Proveedor</TableHead>
            <TableHead>Factura/Ref</TableHead>
            <TableHead>Método de Pago</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {purchases.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">
                {new Date(p.purchaseDate).toLocaleDateString("es-CO")}
              </TableCell>
              <TableCell>{p.provider?.name || "Desconocido"}</TableCell>
              <TableCell>{p.invoiceNumber || p.referenceCode || "—"}</TableCell>
              <TableCell className="capitalize">{p.paymentMethod}</TableCell>
              <TableCell className="text-right font-mono font-medium text-[color:var(--tf-green)]">
                {formatCurrency(Number(p.totalAmount))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
