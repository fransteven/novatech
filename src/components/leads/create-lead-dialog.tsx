"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { createLeadAction } from "@/app/actions/lead-actions";
import { toast } from "sonner";

interface CreateLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const DEFAULT_FORM = {
  prospectName: "",
  prospectPhone: "",
  productDescription: "",
  costPrice: "",
  salePrice: "",
  interestRate: "5",
  termMonths: "12",
  notes: "",
};

export function CreateLeadDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateLeadDialogProps) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [isPending, startTransition] = useTransition();

  const set = (field: keyof typeof DEFAULT_FORM) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createLeadAction({
        prospectName: form.prospectName.trim(),
        prospectPhone: form.prospectPhone.trim(),
        productDescription: form.productDescription.trim(),
        costPrice: parseFloat(form.costPrice),
        salePrice: parseFloat(form.salePrice),
        interestRate: parseFloat(form.interestRate) / 100,
        termMonths: parseInt(form.termMonths, 10),
        notes: form.notes.trim() || undefined,
      });

      if (res.success) {
        toast.success("Lead creado correctamente");
        setForm(DEFAULT_FORM);
        onOpenChange(false);
        onCreated();
      } else {
        toast.error(res.error ?? "Error al crear el lead");
      }
    });
  };

  const handleOpenChange = (v: boolean) => {
    if (!isPending) {
      if (!v) setForm(DEFAULT_FORM);
      onOpenChange(v);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo Lead</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="prospectName">Nombre del prospecto</Label>
              <Input
                id="prospectName"
                placeholder="Ej. María García"
                value={form.prospectName}
                onChange={set("prospectName")}
                required
              />
            </div>

            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="prospectPhone">Teléfono</Label>
              <Input
                id="prospectPhone"
                placeholder="+57 300 123 4567"
                value={form.prospectPhone}
                onChange={set("prospectPhone")}
                required
              />
            </div>

            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="productDescription">Producto de interés</Label>
              <Input
                id="productDescription"
                placeholder="Ej. iPhone 17 Pro 256GB"
                value={form.productDescription}
                onChange={set("productDescription")}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="costPrice">Costo (COP)</Label>
              <Input
                id="costPrice"
                type="number"
                placeholder="4200000"
                value={form.costPrice}
                onChange={set("costPrice")}
                required
                min={0}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="salePrice">Precio de venta (COP)</Label>
              <Input
                id="salePrice"
                type="number"
                placeholder="4500000"
                value={form.salePrice}
                onChange={set("salePrice")}
                required
                min={0}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="interestRate">Recargo mensual (%)</Label>
              <Input
                id="interestRate"
                type="number"
                placeholder="5"
                value={form.interestRate}
                onChange={set("interestRate")}
                required
                min={0.1}
                max={100}
                step={0.1}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="termMonths">Plazo (meses)</Label>
              <Input
                id="termMonths"
                type="number"
                placeholder="12"
                value={form.termMonths}
                onChange={set("termMonths")}
                required
                min={1}
                max={60}
              />
            </div>

            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="notes">Notas (opcional)</Label>
              <Textarea
                id="notes"
                placeholder="Observaciones adicionales…"
                value={form.notes}
                onChange={set("notes")}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando…
                </>
              ) : (
                "Crear lead"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
