"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/formatters";
import { addLayawayPaymentAction } from "@/app/actions/layaway-actions";
import { toast } from "sonner";
import { DollarSign } from "lucide-react";

type CashAccount = { id: string; name: string };

import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LayawayPaymentDialogProps {
  layawayId: string | null;
  balance: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  accounts: CashAccount[];
}

export function LayawayPaymentDialog({
  layawayId,
  balance,
  open,
  onOpenChange,
  onSuccess,
  accounts,
}: LayawayPaymentDialogProps) {
  const [processing, setProcessing] = useState(false);
  const [amount, setAmount] = useState<number | "">("");
  const [method, setMethod] = useState<string>("cash");
  const [accountId, setAccountId] = useState<string>("");

  const handlePayment = async () => {
    if (!layawayId || !amount || amount <= 0) {
      toast.error("Ingrese un monto válido");
      return;
    }
    if (amount > balance) {
      toast.error("El abono supera el saldo de la deuda");
      return;
    }
    if (!accountId) {
      toast.error("Selecciona una cuenta para registrar el abono");
      return;
    }

    setProcessing(true);
    try {
      const res = await addLayawayPaymentAction({
        layawayId,
        amount: Number(amount),
        paymentMethod: method,
        accountId,
        notes: amount === balance ? "Liquidación final de apartado" : "Abono a apartado",
      });

      if (res.success) {
        toast.success(amount === balance ? "Apartado Completado. Inventario y Venta registrados." : "Abono registrado exitosamente");
        setAmount("");
        setMethod("cash");
        setAccountId("");
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error("Error al registrar abono", { description: res.error });
      }
    } catch (error) {
      toast.error("Error crítico al procesar el pago");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-4 sm:p-6 sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Registrar Abono</DialogTitle>
          <DialogDescription>
            El saldo pendiente es de <strong className="text-primary">{formatCurrency(balance)}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
            <Label htmlFor="amount" className="sm:w-24 sm:text-right">Monto a Pagar</Label>
            <div className="relative flex-1">
              <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="amount"
                type="number"
                min="1"
                max={balance}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="pl-8"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
            <Label className="sm:w-24 sm:text-right">Método</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Efectivo</SelectItem>
                <SelectItem value="transfer">Transferencia</SelectItem>
                <SelectItem value="card">Tarjeta / Datáfono</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
            <Label className="sm:w-24 sm:text-right">Cuenta</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecciona una cuenta..." />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
            Cancelar
          </Button>
          <Button onClick={handlePayment} disabled={processing || !amount}>
            {processing ? "Procesando..." : amount === balance ? "Liquidar Apartado" : "Registrar Abono"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
