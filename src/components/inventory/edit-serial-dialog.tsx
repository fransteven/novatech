"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateSerialItemAction } from "@/app/actions/inventory-actions";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";
import { normalizeSerial } from "@/lib/serials";
import { ScanButton } from "@/components/scanner/scan-button";
import {
  DEFAULT_CONDITION_WARRANTY,
  ITEM_CONDITIONS,
  ITEM_CONDITION_LABELS,
  WARRANTY_MONTH_PRESETS,
  type ItemCondition,
} from "@/lib/validators/inventory-validator";

interface SerialToEdit {
  id: string;
  serialNumber: string | null;
  sku: string | null;
  status: string;
  unitCost?: string | number | null;
  condition?: string | null;
  warrantyMonths?: number | null;
  notes?: string | null;
  conditionDetails?: { batteryHealth?: number } | null;
}

interface EditSerialDialogProps {
  item: SerialToEdit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const STATUS_OPTIONS = [
  { value: "available", label: "Disponible" },
  { value: "reserved", label: "Apartado" },
  { value: "sold", label: "Vendido" },
  { value: "defective", label: "Defectuoso" },
];

const toFormState = (item: SerialToEdit) => ({
  serialNumber: item.serialNumber || "",
  sku: item.sku || "",
  status: item.status,
  unitCost: item.unitCost !== null && item.unitCost !== undefined
    ? String(item.unitCost)
    : "",
  condition: (item.condition ?? "new") as ItemCondition,
  warrantyMonths: item.warrantyMonths ? String(item.warrantyMonths) : "",
  batteryHealth: item.conditionDetails?.batteryHealth
    ? String(item.conditionDetails.batteryHealth)
    : "",
  notes: item.notes || "",
});

export function EditSerialDialog({
  item,
  open,
  onOpenChange,
  onSuccess,
}: EditSerialDialogProps) {
  const [form, setForm] = useState(() =>
    item ? toFormState(item) : toFormState({ id: "", serialNumber: "", sku: "", status: "available" }),
  );
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (item) {
      setForm(toFormState(item));
      setConfirming(false);
    }
  }, [item]);

  if (!item) return null;

  const handleReview = () => {
    const cost = parseFloat(form.unitCost);
    if (Number.isNaN(cost) || cost < 0) {
      toast.error("El costo debe ser un número positivo o cero");
      return;
    }
    if (!form.serialNumber.trim()) {
      toast.error("El serial/IMEI no puede quedar vacío");
      return;
    }
    if (form.batteryHealth) {
      const battery = parseFloat(form.batteryHealth);
      if (Number.isNaN(battery) || battery < 1 || battery > 100) {
        toast.error("La salud de batería debe estar entre 1 y 100");
        return;
      }
    }
    setConfirming(true);
  };

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await updateSerialItemAction({
        itemId: item.id,
        serialNumber: form.serialNumber.trim(),
        sku: form.sku.trim() || null,
        status: form.status,
        unitCost: parseFloat(form.unitCost),
        condition: form.condition,
        warrantyMonths: form.warrantyMonths
          ? Number(form.warrantyMonths)
          : null,
        batteryHealth: form.batteryHealth
          ? parseFloat(form.batteryHealth)
          : undefined,
        notes: form.notes.trim() || null,
      });

      if (result.success) {
        toast.success("Registro corregido correctamente");
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(result.error || "Error al corregir el registro");
        setConfirming(false);
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!isPending) {
          onOpenChange(v);
          if (!v) setConfirming(false);
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        {!confirming ? (
          <>
            <DialogHeader>
              <DialogTitle>Corregir registro de inventario</DialogTitle>
              <DialogDescription>
                Corrige datos capturados de forma errada para este serial. Esta
                acción queda registrada en la auditoría del sistema.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label htmlFor="serialNumber">
                  Serial / IMEI <span className="text-destructive">*</span>
                </Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    id="serialNumber"
                    className="font-mono"
                    value={form.serialNumber}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, serialNumber: e.target.value }))
                    }
                  />
                  <ScanButton
                    mode="single"
                    enableImeiOcr={true}
                    title="Escanear Corrección de Serial"
                    description="Escanear código de barras o IMEI con OCR"
                    onScan={(scanned) => {
                      const normalized = normalizeSerial(scanned);
                      if (!normalized) {
                        return { status: "rejected", message: "Serial inválido" };
                      }
                      setForm((f) => ({ ...f, serialNumber: normalized }));
                      return { status: "accepted" };
                    }}
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    aria-label="Escanear serial o IMEI"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="sku">SKU</Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    id="sku"
                    className="font-mono"
                    value={form.sku}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, sku: e.target.value }))
                    }
                  />
                  <ScanButton
                    mode="single"
                    enableImeiOcr={false}
                    title="Escanear SKU"
                    description="Escanear código de barras del SKU"
                    onScan={(scanned) => {
                      setForm((f) => ({ ...f, sku: scanned.trim() }));
                      return { status: "accepted" };
                    }}
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    aria-label="Escanear SKU"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Estado</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="unitCost">
                  Costo unitario (COP) <span className="text-destructive">*</span>
                </Label>
                <MoneyInput
                  id="unitCost"
                  min={0}
                  value={form.unitCost ? Number(form.unitCost) : null}
                  onValueChange={(value) => setForm((f) => ({ ...f, unitCost: value === null ? "" : String(value) }))}
                />
              </div>

              <div className="space-y-1">
                <Label>Condición</Label>
                <Select
                  value={form.condition}
                  onValueChange={(v) =>
                    setForm((f) => {
                      const preset = DEFAULT_CONDITION_WARRANTY[v as ItemCondition];
                      return {
                        ...f,
                        condition: v as ItemCondition,
                        // Nuevo vuelve a heredar la garantía del modelo.
                        warrantyMonths: preset ? String(preset) : "",
                      };
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEM_CONDITIONS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {ITEM_CONDITION_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {form.condition !== "new" && (
                <div className="space-y-1">
                  <Label>Garantía de la unidad</Label>
                  <Select
                    value={form.warrantyMonths}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, warrantyMonths: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Meses de cobertura" />
                    </SelectTrigger>
                    <SelectContent>
                      {WARRANTY_MONTH_PRESETS.map((months) => (
                        <SelectItem key={months} value={String(months)}>
                          {months} {months === 1 ? "mes" : "meses"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Pisa la garantía del modelo solo para esta unidad
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="batteryHealth">Salud de batería (%)</Label>
                <Input
                  id="batteryHealth"
                  type="number"
                  min={1}
                  max={100}
                  value={form.batteryHealth}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, batteryHealth: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  id="notes"
                  rows={2}
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleReview}>Revisar cambios</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-500" />
                Confirmar corrección
              </DialogTitle>
              <DialogDescription>
                Vas a modificar un registro de inventario ya existente. Esta
                acción quedará registrada con tu usuario en el historial de
                auditoría y no se puede deshacer automáticamente.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">Serial:</span>{" "}
                {form.serialNumber}
              </p>
              <p>
                <span className="text-muted-foreground">Estado:</span>{" "}
                {STATUS_OPTIONS.find((s) => s.value === form.status)?.label}
              </p>
              <p>
                <span className="text-muted-foreground">Costo:</span>{" "}
                {form.unitCost}
              </p>
              <p>
                <span className="text-muted-foreground">Condición:</span>{" "}
                {ITEM_CONDITION_LABELS[form.condition]}
                {form.condition !== "new" && form.warrantyMonths
                  ? ` · ${form.warrantyMonths} mes(es) de garantía`
                  : ""}
              </p>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirming(false)}
                disabled={isPending}
              >
                Volver
              </Button>
              <Button onClick={handleConfirm} disabled={isPending}>
                {isPending ? "Guardando..." : "Confirmar corrección"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
