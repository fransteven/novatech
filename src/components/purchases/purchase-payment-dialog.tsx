"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { registerPurchasePaymentAction } from "@/app/actions/purchase-actions";
import { formatCurrency } from "@/lib/formatters";

interface PurchasePaymentDialogProps {
  purchaseId: string;
  pendingAmount: number;
  cashAccounts: { id: string; name: string; balance?: string | number }[];
  onPaid?: () => void;
}

/** Abono a una compra a crédito: mueve caja y actualiza el saldo al proveedor. */
export function PurchasePaymentDialog({
  purchaseId,
  pendingAmount,
  cashAccounts,
  onPaid,
}: PurchasePaymentDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState(String(pendingAmount));
  const [accountId, setAccountId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("transfer");
  const [referenceCode, setReferenceCode] = useState("");

  const submit = async () => {
    if (!accountId) {
      toast.error("Selecciona la cuenta de caja");
      return;
    }

    setLoading(true);
    try {
      const res = await registerPurchasePaymentAction({
        purchaseId,
        amount: Number(amount),
        accountId,
        paymentMethod,
        referenceCode: referenceCode || undefined,
        idempotencyKey: crypto.randomUUID(),
      });

      if (res.success) {
        toast.success("Abono registrado");
        setOpen(false);
        onPaid?.();
      } else {
        toast.error(res.error || "Error al registrar el abono");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Wallet className="h-4 w-4 mr-2" />
          Registrar abono
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Abono al proveedor</DialogTitle>
          <DialogDescription>
            Saldo pendiente: {formatCurrency(pendingAmount)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Monto</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Cuenta de caja</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar cuenta" />
              </SelectTrigger>
              <SelectContent>
                {cashAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} ({formatCurrency(Number(account.balance ?? 0))})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Método</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="card">Tarjeta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Referencia</Label>
              <Input
                value={referenceCode}
                onChange={(event) => setReferenceCode(event.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={loading}>
            {loading ? "Registrando..." : "Registrar abono"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
