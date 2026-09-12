"use client";

import type {
  FieldErrors,
  UseFormRegister,
  UseFormSetValue,
} from "react-hook-form";
import { AlertTriangle, Info } from "lucide-react";

import type { CreatePurchaseSchema } from "@/lib/validators/purchase-validator";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MoneyInput } from "@/components/ui/money-input";
import { cn } from "@/lib/utils";

export type PaymentMode = "paid" | "partial" | "pending";

const PAYMENT_MODES = [
  { id: "paid", label: "Contado" },
  { id: "partial", label: "Abono" },
  { id: "pending", label: "Crédito" },
] as const;

interface CashAccount {
  id: string;
  name: string;
  balance?: string | number;
}

interface PurchasePaymentSectionProps {
  paymentMode: PaymentMode;
  onPaymentModeChange: (mode: PaymentMode) => void;
  total: number;
  amountPaid: number;
  onAmountPaidChange: (amount: number) => void;
  cashAccounts: CashAccount[];
  accountId: string | null | undefined;
  paymentMethod: string;
  register: UseFormRegister<CreatePurchaseSchema>;
  errors: FieldErrors<CreatePurchaseSchema>;
  setValue: UseFormSetValue<CreatePurchaseSchema>;
  numberField: { setValueAs: (v: unknown) => number };
}

const FieldError = ({ message }: { message?: string }) =>
  message ? <p className="text-destructive text-xs">{message}</p> : null;

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function PurchasePaymentSection({
  paymentMode,
  onPaymentModeChange,
  total,
  amountPaid,
  onAmountPaidChange,
  cashAccounts,
  accountId,
  paymentMethod,
  register,
  errors,
  setValue,
  numberField,
}: PurchasePaymentSectionProps) {
  const selectedAccount = cashAccounts.find((acc) => acc.id === accountId);
  const accountBalance = Number(selectedAccount?.balance ?? 0);
  const balanceAfter = accountBalance - amountPaid;
  const insufficientBalance = selectedAccount !== undefined && balanceAfter < 0;

  const handleAmountChange = (raw: number) => {
    const clamped = Math.max(0, Math.min(raw, total));
    setValue("amountPaid", clamped, { shouldValidate: true, shouldDirty: true });
    onAmountPaidChange(clamped);
  };

  const handleShortcutClick = (fraction: "total" | "half" | "zero") => {
    let target = 0;
    if (fraction === "total") target = total;
    else if (fraction === "half") target = Math.round(total / 2);
    else if (fraction === "zero") target = 0;

    handleAmountChange(target);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <Label className="text-base font-semibold">Pago al proveedor</Label>

        {/* Segmented control para los 3 modos de pago */}
        <div
          role="radiogroup"
          aria-label="Condición de pago"
          className="inline-flex p-0.5 rounded-[10px] bg-muted border border-border self-start sm:self-auto"
        >
          {PAYMENT_MODES.map((mode) => {
            const isActive = paymentMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => onPaymentModeChange(mode.id)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-[8px] transition-all cursor-pointer select-none",
                  isActive
                    ? "bg-card text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                style={
                  isActive ? { boxShadow: "var(--tf-shadow-sm)" } : undefined
                }
              >
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>

      {paymentMode === "pending" ? (
        /* Modo Crédito: colapso elegante a una sola línea informativa */
        <div className="rounded-[10px] bg-muted/40 border border-border p-3.5 text-xs text-muted-foreground flex items-center gap-2.5">
          <Info className="h-4 w-4 text-muted-foreground shrink-0" />
          <span>
            <strong className="text-foreground">A crédito</strong> · Sin
            movimiento de caja inicial. Se registrará la compra con saldo
            pendiente al proveedor.
          </span>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Monto y atajos */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-7 space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="amount-paid-input" className="text-xs">
                  Monto pagado ahora
                </Label>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 px-1.5 text-[11px] font-mono"
                    onClick={() => handleShortcutClick("total")}
                  >
                    Total
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 px-1.5 text-[11px] font-mono"
                    onClick={() => handleShortcutClick("half")}
                  >
                    50%
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 px-1.5 text-[11px] font-mono"
                    onClick={() => handleShortcutClick("zero")}
                  >
                    $0
                  </Button>
                </div>
              </div>
              <MoneyInput
                id="amount-paid-input"
                step="0.01"
                min="0"
                max={total > 0 ? total : undefined}
                className="h-9 text-[14px]"
                {...register("amountPaid", {
                  ...numberField,
                  onChange: (event) =>
                    handleAmountChange(toNumber(event.target.value)),
                })}
              />
              <FieldError message={errors.amountPaid?.message} />
            </div>

            <div className="sm:col-span-5 pb-1 text-xs text-muted-foreground">
              {total - amountPaid > 0 ? (
                <span>
                  Saldo pendiente:{" "}
                  <strong className="font-mono text-[color:var(--tf-amber)]">
                    {formatCurrency(total - amountPaid)}
                  </strong>
                </span>
              ) : (
                <span className="text-[color:var(--tf-green)] font-medium">
                  Cubierto al 100% de contado
                </span>
              )}
            </div>
          </div>

          {/* Cuenta, método y referencia */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="account-select" className="text-xs">
                Cuenta de caja *
              </Label>
              <Select
                value={accountId ?? ""}
                onValueChange={(val) =>
                  setValue("accountId", val, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
              >
                <SelectTrigger id="account-select" className="h-9">
                  <SelectValue placeholder="Seleccionar cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {cashAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} (
                      {formatCurrency(Number(account.balance ?? 0))})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedAccount && (
                <p className="text-[11px] text-muted-foreground">
                  Saldo después:{" "}
                  <span
                    className={cn(
                      "font-mono font-medium",
                      balanceAfter < 0
                        ? "text-[color:var(--tf-red)]"
                        : "text-foreground",
                    )}
                  >
                    {formatCurrency(balanceAfter)}
                  </span>
                </p>
              )}
              <FieldError message={errors.accountId?.message} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="payment-method-select" className="text-xs">
                Método de pago
              </Label>
              <Select
                value={paymentMethod}
                onValueChange={(val) =>
                  setValue("paymentMethod", val, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
              >
                <SelectTrigger id="payment-method-select" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="card">Tarjeta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reference-code-input" className="text-xs">
                Referencia
              </Label>
              <Input
                id="reference-code-input"
                placeholder="Comprobante o recibo"
                className="h-9 text-[13px]"
                {...register("referenceCode")}
              />
            </div>
          </div>

          {/* Alerta si el pago sobregira la cuenta seleccionada */}
          {insufficientBalance && (
            <Alert className="border-[color:var(--tf-amber)] bg-[color:var(--tf-amber-soft)] text-[color:var(--tf-amber)] py-2.5">
              <AlertTriangle className="h-4 w-4 text-[color:var(--tf-amber)]" />
              <AlertDescription className="text-xs text-[color:var(--tf-amber)]">
                El pago supera el saldo registrado de la cuenta. Se registrará
                igual y la cuenta quedará en saldo negativo.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}
