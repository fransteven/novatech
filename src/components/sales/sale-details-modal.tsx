"use client";

import { useEffect, useState } from "react";
import {
  DetailSheet,
} from "@/components/ui/detail-sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSaleDetailsAction } from "@/app/actions/sales-actions";
import { Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface SaleDetail {
  id: string;
  productName: string;
  /** Precio unitario: el total de la línea es price * quantity. */
  price: string;
  quantity: number;
  sku: string | null;
  serialNumber: string | null;
}

interface SaleDetailsModalProps {
  saleId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SaleDetailsModal({
  saleId,
  isOpen,
  onClose,
}: SaleDetailsModalProps) {
  const [details, setDetails] = useState<SaleDetail[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && saleId) {
      const fetchDetails = async () => {
        setIsLoading(true);
        const result = await getSaleDetailsAction(saleId);
        if (result.success && result.data) {
          setDetails(result.data as SaleDetail[]);
        }
        setIsLoading(false);
      };
      fetchDetails();
    } else {
      setDetails([]);
    }
  }, [isOpen, saleId]);

  return (
    <DetailSheet
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title="Detalles de la venta"
      description="Líneas registradas en la operación seleccionada."
      wide
      bodyClassName="p-5 sm:p-6"
    >
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>SKU/Serial</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead className="text-right">Precio unit.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {details.length > 0 ? (
                  details.map((detail) => (
                    <TableRow key={detail.id}>
                      <TableCell className="font-medium">
                        {detail.productName}
                      </TableCell>
                      <TableCell>
                        {detail.sku || detail.serialNumber || "-"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {detail.quantity}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatCurrency(detail.price)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatCurrency(Number(detail.price) * detail.quantity)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      No se encontraron detalles para esta venta.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
    </DetailSheet>
  );
}
