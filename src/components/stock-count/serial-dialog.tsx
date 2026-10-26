"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScanButton } from "@/components/scanner";
import { addSerialToCountAction } from "@/app/actions/stock-count-actions";
import type { ItemCondition } from "@/lib/validators/inventory-validator";

interface SerialDialogProps {
  countId: string;
  product: { id: string; name: string } | null;
  condition: ItemCondition;
  onOpenChange: (open: boolean) => void;
  onAdded: (quantity: number) => void;
}

/**
 * Un producto serializado (consola) se cuenta unidad por unidad: después de
 * escanear la caja se pide el serial de esa unidad.
 */
export const SerialDialog = ({
  countId,
  product,
  condition,
  onOpenChange,
  onAdded,
}: SerialDialogProps) => {
  const [serial, setSerial] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = (value: string) => {
    if (!product || !value.trim()) return;
    startTransition(async () => {
      const result = await addSerialToCountAction({
        countId,
        productId: product.id,
        condition,
        serial: value.trim(),
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setSerial("");
      onAdded(result.data.quantity);
      onOpenChange(false);
    });
  };

  return (
    <Dialog
      open={product !== null}
      onOpenChange={(open) => {
        if (!open) setSerial("");
        onOpenChange(open);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Serial de la unidad</DialogTitle>
          <DialogDescription>{product?.name}</DialogDescription>
        </DialogHeader>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            submit(serial);
          }}
        >
          <Input
            autoFocus
            value={serial}
            className="mono h-11"
            placeholder="Escanea o escribe el serial"
            onChange={(event) => setSerial(event.target.value)}
          />
          <ScanButton
            className="h-11 w-11 shrink-0"
            title="Escanear serial"
            onScan={(value) => {
              submit(value);
              return { status: "accepted", complete: true };
            }}
          />
        </form>
        <DialogFooter>
          <Button
            type="button"
            className="h-11 w-full sm:w-auto"
            disabled={!serial.trim() || pending}
            onClick={() => submit(serial)}
          >
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Agregar unidad
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
