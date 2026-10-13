"use client";

import { useCallback, useEffect, useState } from "react";
import { Barcode, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  addProductBarcodeAction,
  getProductBarcodesAction,
  removeProductBarcodeAction,
} from "@/app/actions/inventory-actions";
import { BARCODE_KIND_LABELS, type BarcodeKind } from "@/lib/barcodes";
import { BarcodeScanInput } from "./barcode-scan-input";

interface ProductBarcode {
  id: string;
  code: string;
  kind: string;
}

interface ProductBarcodesPanelProps {
  productId: string;
  isAdmin: boolean;
}

/**
 * Seriales de caja / UPC de un producto no serializado. Son los códigos que el
 * lector escanea en POS e inventario para encontrar el producto.
 */
export function ProductBarcodesPanel({ productId, isAdmin }: ProductBarcodesPanelProps) {
  const [barcodes, setBarcodes] = useState<ProductBarcode[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const result = await getProductBarcodesAction(productId);
    if (result.success) setBarcodes(result.data);
  }, [productId]);

  useEffect(() => {
    let cancelled = false;
    getProductBarcodesAction(productId).then((result) => {
      if (!cancelled && result.success) setBarcodes(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const handleAdd = async (code: string) => {
    if (barcodes.some((b) => b.code === code)) {
      toast.info(`${code} ya está registrado`);
      return;
    }
    setBusy(true);
    const result = await addProductBarcodeAction({ productId, code });
    setBusy(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`Código ${code} agregado`);
    refresh();
  };

  const handleRemove = async (barcode: ProductBarcode) => {
    setBusy(true);
    const result = await removeProductBarcodeAction({ id: barcode.id });
    setBusy(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`Código ${barcode.code} eliminado`);
    refresh();
  };

  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="flex items-center gap-2">
        <Barcode className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Códigos de barras</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Serial de caja o UPC. Al escanear cualquiera de estos códigos en POS o
        inventario se encuentra este producto.
      </p>
      <BarcodeScanInput onAdd={handleAdd} disabled={busy} />
      {barcodes.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin códigos registrados.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {barcodes.map((barcode) => (
            <li
              key={barcode.id}
              className="flex items-center justify-between gap-2 px-3 py-2"
            >
              <span className="font-mono text-sm break-all">{barcode.code}</span>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="text-[10px]">
                  {BARCODE_KIND_LABELS[barcode.kind as BarcodeKind] ?? barcode.kind}
                </Badge>
                {isAdmin && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleRemove(barcode)}
                    title="Quitar código (admin)"
                    aria-label={`Quitar ${barcode.code}`}
                    className="rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
