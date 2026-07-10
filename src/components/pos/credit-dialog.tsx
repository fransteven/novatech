"use client";

import { useState, useEffect, useMemo } from "react";
import { formatCurrency } from "@/lib/formatters";
import { HandCoins, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { createLayawayAction } from "@/app/actions/layaway-actions";
import { getCashAccountsAction } from "@/app/actions/cash-actions";
import { generateSchedule } from "@/lib/credit/amortization";
import { AmortizationPreview } from "@/components/leads/amortization-preview";
import { Customer } from "./customer-selector";

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
import { Separator } from "@/components/ui/separator";

interface CartItem {
  productId: string;
  productItemId: string | null;
  name: string;
  price: number;
  isSerialized: boolean;
  quantity: number;
}

interface CreditDialogProps {
  cartItems: CartItem[];
  totalAmount: number;
  selectedCustomer: Customer | null;
  onSuccess: () => void;
}

export function CreditDialog({
  cartItems,
  totalAmount,
  selectedCustomer,
  onSuccess,
}: CreditDialogProps) {
  const [open, setOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [deposit, setDeposit] = useState<number>(0);
  const [termMonths, setTermMonths] = useState<number>(6);
  const [interestRatePct, setInterestRatePct] = useState<number>(5);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer" | "card">("cash");
  const [accountId, setAccountId] = useState<string>("");
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    getCashAccountsAction().then((res) => {
      if (res.success && res.data) setAccounts(res.data);
    });
  }, []);

  // Por defecto, vencimiento en 30 días (renovable; el cronograma real usa termMonths)
  const defaultDate = new Date();
  defaultDate.setDate(defaultDate.getDate() + 30);
  const [expiresAt, setExpiresAt] = useState<string>(
    defaultDate.toISOString().split("T")[0]
  );

  const pendingBalance = totalAmount - deposit;
  const monthlyRate = interestRatePct / 100;

  const schedule = useMemo(() => {
    if (pendingBalance <= 0 || monthlyRate <= 0 || termMonths < 1) return [];
    try {
      return generateSchedule({
        principal: pendingBalance,
        monthlyRate,
        termMonths,
        startDate: new Date(),
      });
    } catch {
      return [];
    }
  }, [pendingBalance, monthlyRate, termMonths]);

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && !selectedCustomer) {
      toast.error("Cliente Requerido", {
        description: "Debe seleccionar o registrar un cliente antes de poder crear un crédito.",
      });
      return;
    }
    setOpen(newOpen);
  };

  const handleCreateCredit = async () => {
    if (!selectedCustomer) return;
    if (deposit < 0) {
      toast.error("El abono no puede ser negativo");
      return;
    }
    if (deposit >= totalAmount) {
      toast.error("El abono no puede ser mayor o igual al total de la compra");
      return;
    }
    if (deposit > 0 && !accountId) {
      toast.error("Selecciona una cuenta para registrar el abono");
      return;
    }
    if (termMonths < 1) {
      toast.error("El plazo debe ser al menos 1 mes");
      return;
    }
    if (interestRatePct <= 0) {
      toast.error("La tasa de interés debe ser mayor a cero");
      return;
    }

    setProcessing(true);

    try {
      const response = await createLayawayAction({
        customerId: selectedCustomer.id,
        type: "credito",
        items: cartItems,
        totalAmount,
        initialDeposit: deposit,
        termMonths,
        interestRate: monthlyRate,
        paymentMethod,
        expiresAt: new Date(expiresAt),
        ...(deposit > 0 && accountId ? { accountId } : {}),
      });

      if (response.success) {
        toast.success("Crédito creado exitosamente");
        setOpen(false);
        setDeposit(0);
        onSuccess(); // Limpia el carrito desde PosPage
      } else {
        toast.error("Error al crear crédito", { description: response.error });
      }
    } catch {
      toast.error("Error crítico al procesar el crédito");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="w-full h-[46px] font-bold text-[13px] border-input bg-card hover:bg-muted hover:border-primary hover:text-primary text-foreground cursor-pointer gap-2 transition-all duration-150"
          disabled={cartItems.length === 0}
        >
          <HandCoins className="h-4 w-4" />
          Crédito
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-hidden !flex flex-col">
        <DialogHeader>
          <DialogTitle>Crear Crédito</DialogTitle>
          <DialogDescription>
            {selectedCustomer && (
              <span className="block mt-1">
                Cliente: <strong className="text-foreground">{selectedCustomer.name}</strong>
              </span>
            )}
            Se financiará el saldo con cuotas fijas (sistema francés).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4 flex-1 overflow-y-auto min-h-0">
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor Total:</span>
              <span className="font-semibold">{formatCurrency(totalAmount)}</span>
            </div>

            <div className="flex items-center gap-4">
              <Label htmlFor="deposit" className="text-xs w-24">Cuota Inicial</Label>
              <div className="relative flex-1">
                <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="deposit"
                  type="number"
                  min="0"
                  max={totalAmount}
                  value={deposit || ""}
                  onChange={(e) => setDeposit(Number(e.target.value))}
                  className="pl-8"
                  placeholder="0.00"
                />
              </div>
            </div>

            <Separator />

            <div className="flex justify-between items-center text-lg font-bold text-destructive">
              <span>Capital a Financiar:</span>
              <span>{formatCurrency(pendingBalance)}</span>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="termMonths" className="text-xs">Plazo (meses)</Label>
                <Input
                  id="termMonths"
                  type="number"
                  min="1"
                  max="60"
                  value={termMonths || ""}
                  onChange={(e) => setTermMonths(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="interestRate" className="text-xs">Tasa mensual (%)</Label>
                <Input
                  id="interestRate"
                  type="number"
                  min="0"
                  step="0.1"
                  value={interestRatePct || ""}
                  onChange={(e) => setInterestRatePct(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-xs">Vencimiento</Label>
              <div className="col-span-3 relative">
                <Input
                  type="date"
                  value={expiresAt}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            </div>

            {deposit > 0 && (
              <>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right text-xs">Método (Abono)</Label>
                  <div className="col-span-3">
                    <Select value={paymentMethod} onValueChange={(v: "cash" | "transfer" | "card") => setPaymentMethod(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Efectivo</SelectItem>
                        <SelectItem value="transfer">Transferencia</SelectItem>
                        <SelectItem value="card">Tarjeta / Datáfono</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right text-xs">Cuenta</Label>
                  <div className="col-span-3">
                    <Select value={accountId} onValueChange={setAccountId}>
                      <SelectTrigger>
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
              </>
            )}
          </div>

          {schedule.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Cronograma estimado</Label>
              <AmortizationPreview schedule={schedule} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={processing}>
            Cancelar
          </Button>
          <Button onClick={handleCreateCredit} disabled={processing} className="cursor-pointer" style={{ background: "var(--tf-amber)", color: "white" }}>
            {processing ? "Procesando..." : "Confirmar Crédito"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
