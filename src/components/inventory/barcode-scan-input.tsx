"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScanButton } from "@/components/scanner";
import { normalizeBarcode } from "@/lib/barcodes";

interface BarcodeScanInputProps {
  /** Recibe el código ya normalizado. */
  onAdd: (code: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Input para lector de código de barras: el escáner teclea el código y manda
 * Enter. Se intercepta el Enter para agregar el código sin enviar el
 * formulario que lo contiene.
 */
export function BarcodeScanInput({
  onAdd,
  disabled,
  placeholder = "Escanea el serial o UPC de la caja",
}: BarcodeScanInputProps) {
  const [value, setValue] = useState("");

  const submit = (raw: string) => {
    const code = normalizeBarcode(raw);
    if (!code) return;
    onAdd(code);
    setValue("");
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        className="h-8 font-mono text-xs"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit(value);
          }
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        disabled={disabled || !value.trim()}
        onClick={() => submit(value)}
        aria-label="Agregar código"
      >
        <Plus className="h-4 w-4" />
      </Button>
      <ScanButton
        size="icon"
        className="h-8 w-8 shrink-0"
        disabled={disabled}
        title="Escanear código de barras"
        aria-label="Escanear con cámara"
        onScan={(scanned) => {
          submit(scanned);
          return { status: "accepted", complete: true };
        }}
      />
    </div>
  );
}
