"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getProductSerialsAction } from "@/app/actions/inventory-actions";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProductDetailSheetProps {
  product: {
    productId: string;
    productName: string | null;
    sku: string | null;
    isSerialized: boolean;
    stockTotal: number;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Serial {
  id: string;
  serialNumber: string | null;
  sku: string | null;
  status: string;
  conditionDetails?: any;
  notes?: string | null;
  unitCost?: string | number | null;
  createdAt: Date;
}

export function ProductDetailSheet({
  product,
  open,
  onOpenChange,
}: ProductDetailSheetProps) {
  const [serials, setSerials] = useState<Serial[]>([]);
  const [loading, setLoading] = useState(true);

  const formatPrice = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return "N/A";
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(Number(value));
  };

  useEffect(() => {
    if (open && product?.productId && product.isSerialized) {
      setLoading(true);
      getProductSerialsAction(product.productId)
        .then((result) => {
          if (result.success && result.data) {
            setSerials(result.data);
          }
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [open, product]);

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${type} copiado al portapapeles`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "available":
        return <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600">Disponible</Badge>;
      case "reserved":
        return <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50">Apartado</Badge>;
      case "sold":
        return <Badge variant="secondary">Vendido</Badge>;
      case "defective":
        return <Badge variant="destructive">Defectuoso</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col overflow-y-auto sm:max-w-2xl p-6">
        <SheetHeader className="space-y-2 pb-6">
          <SheetTitle>Detalles: {product?.productName || "Producto"}</SheetTitle>
          <SheetDescription>
            {product?.isSerialized
              ? "Lista de seriales/IMEIs registrados para este producto"
              : "Información de inventario para producto genérico"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">Cargando...</p>
            </div>
          ) : !product?.isSerialized ? (
            <div className="flex flex-col items-center justify-center p-8 border rounded-md">
              <p className="mb-4 text-center text-muted-foreground">
                Este producto no es serializado. Puedes agregarlo al carrito buscándolo por su SKU.
              </p>
              <div className="flex items-center gap-4 p-4 border rounded-md bg-muted/50">
                <span className="font-mono text-xl font-bold">{product.sku || "Sin SKU"}</span>
                {product.stockTotal > 0 && product.sku ? (
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(product.sku!, "SKU")}>
                    <Copy className="h-4 w-4 mr-2" /> Copiar SKU
                  </Button>
                ) : (
                  <Badge variant="outline" className={product.stockTotal <= 0 ? "text-destructive" : ""}>
                    {product.stockTotal <= 0 ? "Sin Stock" : "SKU Incompleto"}
                  </Badge>
                )}
              </div>
            </div>
          ) : serials.length > 0 ? (
            <div className="rounded-md border overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Serial / IMEI</TableHead>
                      <TableHead>Condición</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Costo</TableHead>
                      <TableHead>Registro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {serials.map((serial) => (
                      <TableRow key={serial.id}>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-medium">
                              {serial.serialNumber || "N/A"}
                            </span>
                            {serial.status === "available" && (serial.serialNumber || serial.id) && (
                              <button
                                onClick={() => copyToClipboard(serial.serialNumber || serial.id, "Serial")}
                                title="Copiar para vender en POS"
                                className="text-slate-400 hover:text-indigo-600 transition-colors p-0.5 rounded flex-shrink-0"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {serial.conditionDetails?.batteryHealth && (
                              <Badge variant="outline" className="w-fit text-[10px] px-1 h-5">
                                🔋 {serial.conditionDetails.batteryHealth}%
                              </Badge>
                            )}
                            {serial.notes && (
                              <span className="text-[10px] text-muted-foreground line-clamp-1 max-w-[120px]" title={serial.notes}>
                                📝 {serial.notes}
                              </span>
                            )}
                            {!serial.conditionDetails?.batteryHealth && !serial.notes && (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">
                          {serial.sku || "—"}
                        </TableCell>
                        <TableCell>{getStatusBadge(serial.status)}</TableCell>
                        <TableCell className="font-medium text-muted-foreground whitespace-nowrap">
                          {formatPrice(serial.unitCost)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(serial.createdAt).toLocaleDateString("es-ES")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 border rounded-md">
              <p className="text-muted-foreground px-4 text-center">
                Este producto no tiene seriales registrados.
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
