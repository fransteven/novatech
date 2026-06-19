"use client";

import { useState, useTransition } from "react";
import { createCreditorAction } from "@/app/actions/creditor-actions";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface CreateCreditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const DEFAULT_FORM = {
  name: "",
  contactPhone: "",
  notes: "",
};

export function CreateCreditorDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateCreditorDialogProps) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [isPending, startTransition] = useTransition();

  const reset = () => setForm(DEFAULT_FORM);

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await createCreditorAction({
        name: form.name.trim(),
        contactPhone: form.contactPhone.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });

      if (result.success) {
        toast.success("Acreedor creado correctamente");
        reset();
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(result.error || "Error al crear el acreedor");
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo Acreedor</DialogTitle>
          <DialogDescription>
            Registra una persona o entidad que le presta capital al negocio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="name">
              Nombre <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Ej. María González"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="phone">Teléfono de contacto</Label>
            <Input
              id="phone"
              placeholder="Ej. 300 123 4567"
              value={form.contactPhone}
              onChange={(e) =>
                setForm((f) => ({ ...f, contactPhone: e.target.value }))
              }
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              placeholder="Acuerdos generales, condiciones especiales..."
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !form.name.trim()}
          >
            {isPending ? "Guardando..." : "Crear Acreedor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
