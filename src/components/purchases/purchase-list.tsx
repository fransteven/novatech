"use client";

import { useState } from "react";
import { ShoppingCart } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";
import { PurchaseStatusBadge } from "./purchase-status-badge";
import { PurchaseDetailSheet } from "./purchase-detail-sheet";

export interface PurchaseRow {
  id: string;
  purchaseDate: Date | string;
  provider: { name: string } | null;
  invoiceNumber?: string | null;
  referenceCode?: string | null;
  paymentMethod: string;
  paymentStatus: string;
  totalAmount: string | number;
  amountPaid: string | number;
  pendingAmount: number;
  itemCount: number;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  transfer: "Transferencia",
  cash: "Efectivo",
  card: "Tarjeta",
  wallet: "Billetera",
};

interface PurchaseListProps {
  purchases: PurchaseRow[];
  cashAccounts: { id: string; name: string; balance?: string | number }[];
}

export function PurchaseList({ purchases, cashAccounts }: PurchaseListProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (purchases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-card border border-border rounded-lg shadow-sm">
        <ShoppingCart className="h-10 w-10 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No hay compras registradas</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Registra tu primera compra para verla aquí.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Factura/Ref</TableHead>
              <TableHead className="text-right">Ítems</TableHead>
              <TableHead>Pago</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchases.map((purchase) => (
              <TableRow
                key={purchase.id}
                className="cursor-pointer"
                onClick={() => setSelectedId(purchase.id)}
              >
                <TableCell className="font-medium">
                  {new Date(purchase.purchaseDate).toLocaleDateString("es-CO")}
                </TableCell>
                <TableCell>{purchase.provider?.name || "Desconocido"}</TableCell>
                <TableCell>
                  {purchase.invoiceNumber || purchase.referenceCode || "—"}
                </TableCell>
                <TableCell className="text-right">{purchase.itemCount}</TableCell>
                <TableCell>
                  {PAYMENT_METHOD_LABELS[purchase.paymentMethod] ??
                    purchase.paymentMethod}
                </TableCell>
                <TableCell>
                  <PurchaseStatusBadge status={purchase.paymentStatus} />
                </TableCell>
                <TableCell className="text-right font-mono font-medium">
                  {formatCurrency(Number(purchase.totalAmount))}
                </TableCell>
                <TableCell
                  className={`text-right font-mono ${
                    purchase.pendingAmount > 0
                      ? "text-amber-600 dark:text-amber-400 font-semibold"
                      : "text-muted-foreground"
                  }`}
                >
                  {formatCurrency(purchase.pendingAmount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <PurchaseDetailSheet
        purchaseId={selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
        cashAccounts={cashAccounts}
      />
    </>
  );
}
