"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  price: string;
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Detalles de la Venta</DialogTitle>
        </DialogHeader>
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
                  <TableHead className="text-right">Precio</TableHead>
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
                      <TableCell className="text-right">
                        {formatCurrency(detail.price)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center">
                      No se encontraron detalles para esta venta.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
