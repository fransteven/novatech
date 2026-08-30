"use client";

import { useState, useTransition } from "react";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { adjustWarrantyAction } from "@/app/actions/warranty-actions";
import type { WarrantyAnchor } from "@/lib/validators/warranty-validator";

/** `YYYY-MM-DD` en hora local, que es lo que espera `<input type="date">`. */
const toDateInputValue = (date: Date): string => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

interface AdjustWarrantyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor: WarrantyAnchor;
  startDate: Date;
  warrantyMonths: number;
  onAdjusted: () => void;
}

/**
 * Corrección administrativa de la garantía. En apartados y créditos el equipo se
 * entrega en mostrador antes de que el sistema tenga cualquier otra señal de
 * entrega, así que la fecha derivada puede estar corrida.
 */
export function AdjustWarrantyDialog({
  open,
  onOpenChange,
  anchor,
  startDate,
  warrantyMonths,
  onAdjusted,
}: AdjustWarrantyDialogProps) {
  const [date, setDate] = useState(() => toDateInputValue(startDate));
  const [months, setMonths] = useState(String(warrantyMonths));
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  // Reset al abrir, ajustando estado durante el render en vez de en un efecto.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDate(toDateInputValue(startDate));
      setMonths(String(warrantyMonths));
      setNotes("");
    }
  }

  const handleSubmit = () => {
    if (!date) {
      toast.error("Indica la fecha real de entrega");
      return;
    }
    const parsedMonths = Number(months);
    if (!Number.isInteger(parsedMonths) || parsedMonths < 0) {
      toast.error("Los meses de garantía deben ser un entero no negativo");
      return;
    }

    startTransition(async () => {
      const res = await adjustWarrantyAction({
        anchor,
        // Mediodía local: evita que el desfase UTC mueva la fecha un día.
        startDate: new Date(`${date}T12:00:00`),
        warrantyMonths: parsedMonths,
        notes: notes.trim() || undefined,
      });
      if (res.success) {
        toast.success("Garantía ajustada");
        onOpenChange(false);
        onAdjusted();
      } else {
        toast.error(res.error || "Error al ajustar la garantía");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Ajustar Entrega y Cobertura</DialogTitle>
          <DialogDescription>
            La garantía corre desde que el equipo salió físicamente, no desde la
            liquidación del apartado. El cambio queda en la auditoría.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="startDate">Fecha real de entrega</Label>
            <Input
              id="startDate"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="warrantyMonths">Meses de garantía</Label>
            <Input
              id="warrantyMonths"
              type="number"
              min={0}
              value={months}
              onChange={(e) => setMonths(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="adjustNotes">Motivo (opcional)</Label>
            <Textarea
              id="adjustNotes"
              placeholder="Ej: el equipo se entregó al firmar el apartado."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Guardando..." : "Guardar ajuste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
