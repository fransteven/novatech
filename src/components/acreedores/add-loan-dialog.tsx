"use client";

import { useState, useTransition } from "react";
import { v4 as uuidv4 } from "uuid";
import { addLoanAction } from "@/app/actions/creditor-actions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CashAccount {
  id: string;
  name: string;
}

interface AddLoanDialogProps {
  creditorId: string;
  creditorName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  accounts: CashAccount[];
}

const DEFAULT_FORM = {
  amount: "",
  accountId: "",
  paymentMethod: "cash" as const,
  compensationType: "none" as "none" | "per_transaction" | "interest_rate",
  interestRate: "",
  perTransactionFee: "",
  notes: "",
};

export function AddLoanDialog({
  creditorId,
  creditorName,
  open,
  onOpenChange,
  onSuccess,
  accounts,
}: AddLoanDialogProps) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [isPending, startTransition] = useTransition();

  const reset = () => setForm(DEFAULT_FORM);

  const handleSubmit = () => {
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) {
      toast.error("El monto debe ser un número positivo");
      return;
    }
    if (!form.accountId) {
      toast.error("Selecciona una cuenta de caja");
      return;
    }
    if (
      form.compensationType === "interest_rate" &&
      !parseFloat(form.interestRate)
    ) {
      toast.error("Ingresa la tasa de interés");
      return;
    }
    if (
      form.compensationType === "per_transaction" &&
      !parseFloat(form.perTransactionFee)
    ) {
      toast.error("Ingresa el monto de comisión por transacción");
      return;
    }

    startTransition(async () => {
      const result = await addLoanAction({
        creditorId,
        amount,
        accountId: form.accountId,
        paymentMethod: form.paymentMethod,
        compensationType: form.compensationType,
        interestRate:
          form.compensationType === "interest_rate"
            ? parseFloat(form.interestRate) / 100
            : undefined,
        perTransactionFee:
          form.compensationType === "per_transaction"
            ? parseFloat(form.perTransactionFee)
            : undefined,
        idempotencyKey: uuidv4(),
        notes: form.notes.trim() || undefined,
      });

      if (result.success) {
        if (result.duplicate) {
          toast.warning("Este préstamo ya fue registrado anteriormente");
        } else {
          toast.success("Préstamo registrado correctamente");
        }
        reset();
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(result.error || "Error al registrar el préstamo");
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar Préstamo</DialogTitle>
          <DialogDescription>
            {creditorName} presta dinero al negocio. El monto entrará a la
            cuenta de caja seleccionada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Monto */}
          <div className="space-y-1">
            <Label htmlFor="amount">
              Monto prestado (COP) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="amount"
              type="number"
              min={0}
              placeholder="Ej. 2000000"
              value={form.amount}
              onChange={(e) =>
                setForm((f) => ({ ...f, amount: e.target.value }))
              }
            />
          </div>

          {/* Cuenta de caja */}
          <div className="space-y-1">
            <Label>
              Cuenta donde entra el dinero{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Select
              value={form.accountId}
              onValueChange={(v) => setForm((f) => ({ ...f, accountId: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar cuenta..." />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Método de pago */}
          <div className="space-y-1">
            <Label>Método de recepción</Label>
            <Select
              value={form.paymentMethod}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  paymentMethod: v as typeof form.paymentMethod,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Efectivo</SelectItem>
                <SelectItem value="transfer">Transferencia</SelectItem>
                <SelectItem value="card">Tarjeta</SelectItem>
                <SelectItem value="wallet">Billetera digital</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tipo de compensación */}
          <div className="space-y-1">
            <Label>Esquema de compensación</Label>
            <Select
              value={form.compensationType}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  compensationType: v as typeof form.compensationType,
                  interestRate: "",
                  perTransactionFee: "",
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin costo (altruista)</SelectItem>
                <SelectItem value="per_transaction">
                  Comisión por transacción
                </SelectItem>
                <SelectItem value="interest_rate">Tasa de interés</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tasa de interés — solo si aplica */}
          {form.compensationType === "interest_rate" && (
            <div className="space-y-1">
              <Label htmlFor="rate">
                Tasa de interés (% mensual){" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="rate"
                type="number"
                min={0}
                step={0.01}
                placeholder="Ej. 5 para 5%"
                value={form.interestRate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, interestRate: e.target.value }))
                }
              />
            </div>
          )}

          {/* Comisión por transacción — solo si aplica */}
          {form.compensationType === "per_transaction" && (
            <div className="space-y-1">
              <Label htmlFor="fee">
                Comisión por transacción (COP){" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fee"
                type="number"
                min={0}
                placeholder="Ej. 100000"
                value={form.perTransactionFee}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    perTransactionFee: e.target.value,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Esta comisión se devenga manualmente desde el detalle del
                acreedor cada vez que ocurra la transacción acordada.
              </p>
            </div>
          )}

          {/* Notas */}
          <div className="space-y-1">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              placeholder="Condiciones específicas de este préstamo..."
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              rows={2}
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
            disabled={isPending || !form.amount || !form.accountId}
          >
            {isPending ? "Registrando..." : "Registrar Préstamo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
