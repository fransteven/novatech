"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Coins } from "lucide-react";
import { addContributionAction } from "@/app/actions/shareholder-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Shareholder {
  id: string;
  fullName: string;
}

interface AddContributionDialogProps {
  shareholders: Shareholder[];
}

const DEFAULT_FORM = {
  shareholderId: "",
  amount: "",
  notes: "",
  occurredAt: "",
};

export function AddContributionDialog({ shareholders }: AddContributionDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleChange(field: keyof typeof DEFAULT_FORM, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const amount = parseFloat(form.amount);
    if (!form.shareholderId) {
      toast.error("Selecciona un accionista");
      return;
    }
    if (!form.amount || isNaN(amount) || amount <= 0) {
      toast.error("El monto debe ser mayor a 0");
      return;
    }

    startTransition(async () => {
      const result = await addContributionAction({
        shareholderId: form.shareholderId,
        amount,
        notes: form.notes || undefined,
        occurredAt: form.occurredAt ? new Date(form.occurredAt) : undefined,
      });

      if (result.success) {
        toast.success("Aporte registrado", {
          description: "El aporte de capital quedó registrado correctamente.",
        });
        setForm(DEFAULT_FORM);
        setOpen(false);
        router.refresh();
      } else {
        toast.error("Error al registrar aporte", { description: result.error });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="h-[38px] px-[14px] text-[13.5px] font-semibold"
        >
          <Coins className="mr-2 h-4 w-4" />
          Registrar aporte
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Aporte de Capital</DialogTitle>
          <DialogDescription>
            Registra un aporte de capital realizado por un accionista.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Accionista */}
          <div className="space-y-1.5">
            <Label htmlFor="shareholder">Accionista *</Label>
            <Select
              value={form.shareholderId}
              onValueChange={(v) => handleChange("shareholderId", v)}
            >
              <SelectTrigger id="shareholder">
                <SelectValue placeholder="Seleccionar accionista…" />
              </SelectTrigger>
              <SelectContent>
                {shareholders.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Monto */}
          <div className="space-y-1.5">
            <Label htmlFor="amount">Monto (COP) *</Label>
            <Input
              id="amount"
              type="number"
              step="1"
              min="1"
              placeholder="0"
              value={form.amount}
              onChange={(e) => handleChange("amount", e.target.value)}
            />
          </div>

          {/* Fecha */}
          <div className="space-y-1.5">
            <Label htmlFor="occurredAt">Fecha del aporte</Label>
            <Input
              id="occurredAt"
              type="date"
              value={form.occurredAt}
              onChange={(e) => handleChange("occurredAt", e.target.value)}
            />
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Descripción del aporte…"
              className="resize-none"
              rows={2}
              value={form.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-primary text-primary-foreground font-semibold"
            >
              {isPending ? "Registrando…" : "Confirmar aporte"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
