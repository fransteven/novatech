"use client";

import { useState, useRef, useEffect } from "react";
import { ScanBarcode, Plus, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { searchProductAction } from "@/app/actions/pos-action";
import type { ProductSearchResult } from "@/lib/validators/pos-validator";

interface PosProductListProps {
  onAddToCart: (item: {
    productId: string;
    productItemId: string | null;
    name: string;
    price: number;
    isSerialized: boolean;
    quantity: number;
    unitCost: number;
    availableQty?: number;
  }) => void;
}

export function PosProductList({ onAddToCart }: PosProductListProps) {
  const [barcode, setBarcode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProductSearchResult | null>(null);
  const [salePrice, setSalePrice] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!barcode.trim()) return;

    setLoading(true);
    try {
      const response = await searchProductAction(barcode);
      if (response.success && response.data) {
        setResult(response.data);
        setSalePrice(Number(response.data.suggestedPrice));
      } else {
        toast.error(response.error || "Producto no encontrado");
        setResult(null);
      }
    } catch {
      toast.error("Error al buscar el producto");
    } finally {
      setLoading(false);
      setBarcode("");
      inputRef.current?.focus();
    }
  };

  const isPriceInvalid = result ? salePrice < result.avgUnitCost : false;

  const handleAdd = () => {
    if (!result) return;
    if (isPriceInvalid) {
      toast.error("El precio de venta no puede ser menor al costo unitario");
      return;
    }

    if (result.availableQty <= 0) {
      toast.error("Este producto no tiene stock disponible");
      return;
    }

    if (result.isSerialized && !result.productItemId) {
      toast.error("Debe escanear un serial específico para vender este producto.");
      return;
    }

    onAddToCart({
      productId: result.productId,
      productItemId: result.productItemId,
      name: result.name,
      price: salePrice,
      isSerialized: result.isSerialized,
      quantity: 1,
      unitCost: result.avgUnitCost,
      availableQty: result.availableQty,
    });

    setResult(null);
    setBarcode("");
    inputRef.current?.focus();
  };

  const stockVariant = result
    ? result.availableQty > 5
      ? "normal"
      : result.availableQty > 0
        ? "low"
        : "out"
    : null;

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Scanner card */}
      <div className="relative bg-card border border-border rounded-[14px] p-5 overflow-hidden">
        {/* Radial accent glow overlay */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            background:
              "radial-gradient(50% 30% at 50% 0%, var(--tf-accent-soft), transparent 60%)",
          }}
        />

        <form onSubmit={handleSearch} className="relative flex gap-2.5 items-stretch">
          {/* Input */}
          <div
            className="flex flex-1 items-center gap-3 h-14 px-4 bg-background border border-input rounded-[12px] transition-all duration-150 tf-focus-ring"
            style={{ borderWidth: "1.5px" }}
          >
            {/* Pulsing barcode icon */}
            <span className="tf-scan-pulse flex-shrink-0 w-7 h-7 rounded-[8px] bg-accent flex items-center justify-center text-accent-foreground">
              <ScanBarcode className="h-4 w-4" />
            </span>

            <Input
              ref={inputRef}
              placeholder="Escanea un código de barras o escribe el SKU..."
              className="flex-1 h-auto border-0 bg-transparent p-0 text-base font-medium font-mono placeholder:font-sans placeholder:font-normal placeholder:text-muted-foreground shadow-none focus-visible:ring-0"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              disabled={loading}
              autoFocus
            />

            {/* Keyboard hint */}
            <span className="hidden sm:block font-mono text-[10.5px] px-1.5 py-0.5 bg-muted border border-border rounded-[5px] text-muted-foreground whitespace-nowrap select-none">
              / para enfocar
            </span>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={loading || !barcode.trim()}
            className="h-14 px-6 rounded-[12px] bg-primary text-primary-foreground font-semibold text-[14.5px] gap-2 flex-shrink-0 cursor-pointer"
            style={{
              background: "linear-gradient(180deg, var(--tf-accent), oklch(0.52 0.2 270))",
              boxShadow:
                "0 1px 0 inset oklch(1 0 0 / 0.2), 0 6px 18px var(--tf-accent-ring)",
            }}
          >
            <ScanBarcode className="h-4 w-4" />
            {loading ? "Buscando..." : "Agregar"}
          </Button>
        </form>
      </div>

      {/* Product result */}
      {result && (
        <div className="border border-border rounded-[14px] bg-card overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Producto</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Stock Disp.</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wide font-medium text-muted-foreground">P. Sugerido</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Costo Unit.</TableHead>
                <TableHead className="w-[180px] text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Precio de Venta</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="hover:bg-muted/50">
                <TableCell className="font-medium">
                  <div>
                    <span className="text-foreground font-semibold">{result.name}</span>
                    <div className="flex gap-2 mt-1 items-center">
                      <Badge
                        variant="outline"
                        className={`text-[10px] border-0 ${result.isSerialized ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}
                      >
                        {result.isSerialized ? "Serializado" : "No Serializado"}
                      </Badge>
                      {result.sku && (
                        <span className="font-mono text-[11px] text-muted-foreground opacity-70">
                          SKU: {result.sku}
                        </span>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge
                    className={`font-semibold text-[11.5px] rounded-full px-2.5 border-0 ${
                      stockVariant === "normal"
                        ? "tf-badge-normal"
                        : stockVariant === "low"
                          ? "tf-badge-low"
                          : "tf-badge-out"
                    }`}
                  >
                    {result.availableQty}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium font-mono text-foreground">
                  ${Number(result.suggestedPrice).toFixed(2)}
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  ${result.avgUnitCost.toFixed(2)}
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={salePrice}
                      onChange={(e) => setSalePrice(Number(e.target.value))}
                      className={`font-mono ${isPriceInvalid ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    />
                    {isPriceInvalid && (
                      <div className="text-[10px] text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        No puede ser menor al costo
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    onClick={handleAdd}
                    disabled={isPriceInvalid || result.availableQty <= 0}
                    size="sm"
                    className="gap-1 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    Añadir
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-input rounded-[14px] p-12">
          <ScanBarcode className="h-16 w-16 mb-4 opacity-[0.15]" />
          <p className="text-[15px] font-medium text-foreground">Escanea un producto para comenzar</p>
          <p className="text-[12.5px] text-muted-foreground mt-1">
            Los resultados aparecerán aquí para su validación
          </p>
        </div>
      )}
    </div>
  );
}
