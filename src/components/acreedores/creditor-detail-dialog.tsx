"use client";

import { useState, useTransition, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  getCreditorDetailAction,
  registerCreditorPaymentAction,
  recordAccrualAction,
  toggleCreditorStatusAction,
} from "@/app/actions/creditor-actions";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowDownLeft,
  ArrowUpRight,
  HandCoins,
  Plus,
  TrendingDown,
  Info,
} from "lucide-react";
import { AddLoanDialog } from "./add-loan-dialog";

interface CashAccount {
  id: string;
  name: string;
}

interface Creditor {
  id: string;
  name: string;
  contactPhone: string | null;
  notes: string | null;
  isActive: boolean;
  outstandingBalance: number;
  totalLent: number;
  totalPaid: number;
  loanCount: number;
}

interface Movement {
  id: string;
  kind: string;
  amount: number;
  compensationType: string | null;
  interestRate: number | null;
  perTransactionFee: number | null;
  paymentMethod: string | null;
  occurredAt: Date;
  notes: string | null;
}

interface CreditorDetail {
  id: string;
  name: string;
  contactPhone: string | null;
  notes: string | null;
  isActive: boolean;
  movements: Movement[];
  outstandingBalance: number;
}

interface CreditorDetailDialogProps {
  creditor: Creditor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: CashAccount[];
  onSuccess: () => void;
}

const KIND_LABEL: Record<string, string> = {
  loan: "Préstamo recibido",
  payment: "Pago realizado",
  fee: "Comisión devengada",
  interest: "Interés devengado",
};

const COMPENSATION_LABEL: Record<string, string> = {
  none: "Sin costo",
  per_transaction: "Por transacción",
  interest_rate: "Con interés",
};

const DEFAULT_PAYMENT_FORM = {
  amount: "",
  accountId: "",
  paymentMethod: "cash" as const,
  notes: "",
};

const DEFAULT_ACCRUAL_FORM = {
  kind: "fee" as "fee" | "interest",
  amount: "",
  notes: "",
};

export function CreditorDetailDialog({
  creditor,
  open,
  onOpenChange,
  accounts,
  onSuccess,
}: CreditorDetailDialogProps) {
  const [detail, setDetail] = useState<CreditorDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [addLoanOpen, setAddLoanOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState(DEFAULT_PAYMENT_FORM);
  const [accrualForm, setAccrualForm] = useState(DEFAULT_ACCRUAL_FORM);
  const [isPending, startTransition] = useTransition();

  const loadDetail = async () => {
    setLoading(true);
    const res = await getCreditorDetailAction(creditor.id);
    if (res.success && res.data) {
      setDetail(res.data as unknown as CreditorDetail);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handlePayment = () => {
    const amount = parseFloat(paymentForm.amount);
    if (!amount || amount <= 0) {
      toast.error("El monto debe ser un número positivo");
      return;
    }
    if (!paymentForm.accountId) {
      toast.error("Selecciona una cuenta de caja");
      return;
    }

    startTransition(async () => {
      const result = await registerCreditorPaymentAction({
        creditorId: creditor.id,
        amount,
        accountId: paymentForm.accountId,
        paymentMethod: paymentForm.paymentMethod,
        idempotencyKey: uuidv4(),
        notes: paymentForm.notes.trim() || undefined,
      });

      if (result.success) {
        if (result.duplicate) {
          toast.warning("Este pago ya fue registrado anteriormente");
        } else {
          toast.success("Pago registrado correctamente");
        }
        setPaymentForm(DEFAULT_PAYMENT_FORM);
        onSuccess();
        loadDetail();
      } else {
        toast.error(result.error || "Error al registrar el pago");
      }
    });
  };

  const handleAccrual = () => {
    const amount = parseFloat(accrualForm.amount);
    if (!amount || amount <= 0) {
      toast.error("El monto debe ser un número positivo");
      return;
    }

    startTransition(async () => {
      const result = await recordAccrualAction({
        creditorId: creditor.id,
        kind: accrualForm.kind,
        amount,
        idempotencyKey: uuidv4(),
        notes: accrualForm.notes.trim() || undefined,
      });

      if (result.success) {
        if (result.duplicate) {
          toast.warning("Este devengamiento ya fue registrado");
        } else {
          toast.success("Devengamiento registrado correctamente");
        }
        setAccrualForm(DEFAULT_ACCRUAL_FORM);
        onSuccess();
        loadDetail();
      } else {
        toast.error(result.error || "Error al registrar el devengamiento");
      }
    });
  };

  const handleToggleStatus = () => {
    startTransition(async () => {
      const result = await toggleCreditorStatusAction(creditor.id);
      if (result.success) {
        toast.success(
          creditor.isActive ? "Acreedor desactivado" : "Acreedor activado"
        );
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error(result.error || "Error al actualizar el estado");
      }
    });
  };

  const outstanding = detail?.outstandingBalance ?? creditor.outstandingBalance;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HandCoins className="h-5 w-5 text-primary" />
              {creditor.name}
            </DialogTitle>
            <DialogDescription>
              {creditor.contactPhone && (
                <span className="mr-3">📞 {creditor.contactPhone}</span>
              )}
              <Badge variant={creditor.isActive ? "default" : "outline"}>
                {creditor.isActive ? "Activo" : "Inactivo"}
              </Badge>
            </DialogDescription>
          </DialogHeader>

          {/* KPIs del acreedor */}
          <div className="grid grid-cols-3 gap-3 py-2">
            <div className="rounded-lg border p-3 text-center space-y-1">
              <p className="text-xs text-muted-foreground">Saldo Adeudado</p>
              <p
                className={`text-lg font-bold ${outstanding > 0 ? "text-destructive" : "text-muted-foreground"}`}
              >
                {formatCurrency(outstanding)}
              </p>
            </div>
            <div className="rounded-lg border p-3 text-center space-y-1">
              <p className="text-xs text-muted-foreground">Total Prestado</p>
              <p className="text-lg font-bold text-primary">
                {formatCurrency(creditor.totalLent)}
              </p>
            </div>
            <div className="rounded-lg border p-3 text-center space-y-1">
              <p className="text-xs text-muted-foreground">Total Pagado</p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400">
                {formatCurrency(creditor.totalPaid)}
              </p>
            </div>
          </div>

          {creditor.notes && (
            <p className="text-sm text-muted-foreground flex items-start gap-1">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              {creditor.notes}
            </p>
          )}

          <Tabs defaultValue="historial" className="mt-2">
            <TabsList className="w-full">
              <TabsTrigger value="historial" className="flex-1">
                Historial
              </TabsTrigger>
              <TabsTrigger value="pago" className="flex-1" disabled={outstanding <= 0}>
                Registrar Pago
              </TabsTrigger>
              <TabsTrigger value="devengamiento" className="flex-1">
                Devengar
              </TabsTrigger>
            </TabsList>

            {/* HISTORIAL */}
            <TabsContent value="historial" className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {detail?.movements.length ?? 0} movimientos
                </p>
                <Button
                  size="sm"
                  onClick={() => setAddLoanOpen(true)}
                  disabled={!creditor.isActive}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Nuevo Préstamo
                </Button>
              </div>

              {loading ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  Cargando historial...
                </div>
              ) : !detail?.movements.length ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  Sin movimientos registrados
                </div>
              ) : (
                <div className="space-y-2">
                  {detail.movements.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-start gap-3 rounded-lg border p-3"
                    >
                      <div className="mt-0.5">
                        {m.kind === "payment" ? (
                          <ArrowUpRight className="h-4 w-4 text-green-600" />
                        ) : (
                          <ArrowDownLeft className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">
                            {KIND_LABEL[m.kind] ?? m.kind}
                          </span>
                          {m.compensationType && m.kind === "loan" && (
                            <Badge variant="outline" className="text-xs">
                              {COMPENSATION_LABEL[m.compensationType] ??
                                m.compensationType}
                              {m.interestRate &&
                                ` · ${(m.interestRate * 100).toFixed(2)}% mes`}
                              {m.perTransactionFee &&
                                ` · ${formatCurrency(m.perTransactionFee)}/tx`}
                            </Badge>
                          )}
                        </div>
                        {m.notes && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {m.notes}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {new Date(m.occurredAt).toLocaleDateString("es-CO", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                          {m.paymentMethod && ` · ${m.paymentMethod}`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`text-sm font-semibold ${m.kind === "payment" ? "text-green-600 dark:text-green-400" : "text-destructive"}`}
                        >
                          {m.kind === "payment" ? "−" : "+"}
                          {formatCurrency(m.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* REGISTRAR PAGO */}
            <TabsContent value="pago" className="mt-4 space-y-4">
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <span className="font-medium">Saldo adeudado: </span>
                <span className="text-destructive font-semibold">
                  {formatCurrency(outstanding)}
                </span>
              </div>

              <div className="space-y-1">
                <Label htmlFor="pay-amount">
                  Monto a pagar (COP) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="pay-amount"
                  type="number"
                  min={0}
                  max={outstanding}
                  placeholder={`Máx. ${formatCurrency(outstanding)}`}
                  value={paymentForm.amount}
                  onChange={(e) =>
                    setPaymentForm((f) => ({ ...f, amount: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-1">
                <Label>
                  Cuenta de caja <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={paymentForm.accountId}
                  onValueChange={(v) =>
                    setPaymentForm((f) => ({ ...f, accountId: v }))
                  }
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

              <div className="space-y-1">
                <Label>Método de pago</Label>
                <Select
                  value={paymentForm.paymentMethod}
                  onValueChange={(v) =>
                    setPaymentForm((f) => ({
                      ...f,
                      paymentMethod: v as typeof paymentForm.paymentMethod,
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

              <div className="space-y-1">
                <Label htmlFor="pay-notes">Notas</Label>
                <Textarea
                  id="pay-notes"
                  placeholder="Referencia, observaciones..."
                  value={paymentForm.notes}
                  onChange={(e) =>
                    setPaymentForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  rows={2}
                />
              </div>

              <Button
                className="w-full"
                onClick={handlePayment}
                disabled={
                  isPending ||
                  !paymentForm.amount ||
                  !paymentForm.accountId ||
                  outstanding <= 0
                }
              >
                <TrendingDown className="h-4 w-4 mr-2" />
                {isPending ? "Registrando..." : "Confirmar Pago"}
              </Button>
            </TabsContent>

            {/* DEVENGAR */}
            <TabsContent value="devengamiento" className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Registra manualmente una comisión por transacción o interés
                devengado. Esto aumentará el saldo adeudado sin generar un
                movimiento de caja.
              </p>

              <div className="space-y-1">
                <Label>Tipo de devengamiento</Label>
                <Select
                  value={accrualForm.kind}
                  onValueChange={(v) =>
                    setAccrualForm((f) => ({
                      ...f,
                      kind: v as "fee" | "interest",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fee">Comisión por transacción</SelectItem>
                    <SelectItem value="interest">Interés</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="accrual-amount">
                  Monto (COP) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="accrual-amount"
                  type="number"
                  min={0}
                  placeholder="Ej. 100000"
                  value={accrualForm.amount}
                  onChange={(e) =>
                    setAccrualForm((f) => ({ ...f, amount: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="accrual-notes">Notas</Label>
                <Textarea
                  id="accrual-notes"
                  placeholder="Ej. Comisión venta iPhone 14 - 15 jun 2026"
                  value={accrualForm.notes}
                  onChange={(e) =>
                    setAccrualForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  rows={2}
                />
              </div>

              <Button
                className="w-full"
                onClick={handleAccrual}
                disabled={isPending || !accrualForm.amount}
              >
                {isPending ? "Registrando..." : "Registrar Devengamiento"}
              </Button>
            </TabsContent>
          </Tabs>

          {/* Acción de activar/desactivar */}
          <div className="pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={handleToggleStatus}
              disabled={isPending}
            >
              {creditor.isActive ? "Desactivar acreedor" : "Reactivar acreedor"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sub-dialog: nuevo préstamo */}
      <AddLoanDialog
        creditorId={creditor.id}
        creditorName={creditor.name}
        open={addLoanOpen}
        onOpenChange={setAddLoanOpen}
        accounts={accounts}
        onSuccess={() => {
          onSuccess();
          loadDetail();
        }}
      />
    </>
  );
}
