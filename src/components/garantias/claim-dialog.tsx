"use client";

import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
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
import { registerClaimAction } from "@/app/actions/warranty-actions";

interface ClaimDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productItemId: string;
  defaultSerial: string;
  withinWarranty: boolean;
}

export function ClaimDialog({
  open,
  onOpenChange,
  productItemId,
  defaultSerial,
  withinWarranty,
}: ClaimDialogProps) {
  const [issue, setIssue] = useState("");
  const [reportedSerial, setReportedSerial] = useState(defaultSerial);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setIssue("");
      setReportedSerial(defaultSerial);
    }
  }, [open, defaultSerial]);

  const serialMismatch =
    reportedSerial.trim().toLowerCase() !== defaultSerial.trim().toLowerCase();

  const handleSubmit = () => {
    if (!issue.trim()) {
      toast.error("Describe la falla reportada");
      return;
    }
    startTransition(async () => {
      const res = await registerClaimAction({
        productItemId,
        issue,
        reportedSerial,
      });
      if (res.success) {
        toast.success("Reclamo registrado exitosamente");
        onOpenChange(false);
      } else {
        toast.error(res.error || "Error al registrar el reclamo");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Registrar Reclamo de Garantía</DialogTitle>
          <DialogDescription>
            Documenta la falla reportada por el cliente para esta unidad.
          </DialogDescription>
        </DialogHeader>

        {!withinWarranty && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-[13px]">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <span>
              Esta garantía está <strong>vencida</strong>. El reclamo se
              registrará igual, marcado como fuera de cobertura.
            </span>
          </div>
        )}

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="reportedSerial">Serial presentado</Label>
            <Input
              id="reportedSerial"
              value={reportedSerial}
              onChange={(e) => setReportedSerial(e.target.value)}
              className="font-mono"
            />
            {serialMismatch && (
              <p className="text-[12px] text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                No coincide con el serial vendido ({defaultSerial}) — posible
                sustitución de equipo.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="issue">Falla reportada</Label>
            <Textarea
              id="issue"
              placeholder="Ej: No enciende, batería se agota rápido..."
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Guardando..." : "Registrar Reclamo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
