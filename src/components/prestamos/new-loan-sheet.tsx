"use client";

import { useState, useMemo, useEffect } from "react";
import { formatCurrency } from "@/lib/formatters";
import { generateSchedule, type ScheduleEntry } from "@/lib/credit/amortization";
import { createLoanAction } from "@/app/actions/loan-actions";
import { CustomerSelector, type Customer } from "@/components/pos/customer-selector";
import { AmortizationPreview } from "@/components/leads/amortization-preview";
import { MoneyInput } from "@/components/ui/money-input";
import { Button } from "@/components/ui/button";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  Plus,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Percent,
  Landmark,
  Shield,
  Loader2,
} from "lucide-react";

interface CashAccount {
  id: string;
  name: string;
  balance?: number;
}

interface NewLoanSheetProps {
  accounts: CashAccount[];
  onSuccess?: () => void;
}

const COMMON_TERMS = [3, 6, 12, 24];
const COMMON_RATES = [3, 5, 8, 10]; // Porcentajes mensuales

export function NewLoanSheet({ accounts, onSuccess }: NewLoanSheetProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [processing, setProcessing] = useState(false);

  // Idempotencia por intento de apertura
  const [idempotencyKey, setIdempotencyKey] = useState("");

  // Paso 1: Cliente
  const [customer, setCustomer] = useState<Customer | null>(null);

  // Paso 2: Condiciones
  const [principalAmount, setPrincipalAmount] = useState<number | "">("");
  const [termMonths, setTermMonths] = useState<number>(6);
  const [interestRatePct, setInterestRatePct] = useState<number | "">(""); // Tasa porcentual vacía por defecto
  const [firstDueDate, setFirstDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [collateral, setCollateral] = useState("");
  const [notes, setNotes] = useState("");

  // Paso 3: Desembolso y Revisión
  const [accountId, setAccountId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer" | "card">("cash");
  const [originationFeeOpen, setOriginationFeeOpen] = useState(false);
  const [originationFee, setOriginationFee] = useState<number | "">("");

  // Regenerar idempotencyKey al abrir el modal y resetear estado
  useEffect(() => {
    if (open) {
      setIdempotencyKey(crypto.randomUUID());
      if (accounts.length > 0 && !accountId) {
        setAccountId(accounts[0].id);
      }
    } else {
      setStep(1);
      setCustomer(null);
      setPrincipalAmount("");
      setTermMonths(6);
      setInterestRatePct("");
      setCollateral("");
      setNotes("");
      setOriginationFeeOpen(false);
      setOriginationFee("");
    }
  }, [open, accounts, accountId]);

  // Cálculo del cronograma en vivo
  const numericPrincipal = typeof principalAmount === "number" ? principalAmount : 0;
  const numericRate = typeof interestRatePct === "number" && interestRatePct > 0 ? interestRatePct / 100 : 0;

  const schedule: ScheduleEntry[] = useMemo(() => {
    if (numericPrincipal <= 0 || numericRate <= 0 || termMonths < 1) return [];
    try {
      return generateSchedule({
        principal: numericPrincipal,
        monthlyRate: numericRate,
        termMonths,
        startDate: new Date(firstDueDate),
      });
    } catch {
      return [];
    }
  }, [numericPrincipal, numericRate, termMonths, firstDueDate]);

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const accountBalance = selectedAccount?.balance ?? 0;
  const hasInsufficientFunds = selectedAccount?.balance != null && accountBalance < numericPrincipal;

  const totalInterestExpected = useMemo(() => {
    return schedule.reduce((sum, s) => sum + s.interest, 0);
  }, [schedule]);

  const fixedInstallment = schedule[0]?.totalAmount ?? 0;

  // Validaciones por paso
  const canGoToStep2 = customer !== null;
  const canGoToStep3 =
    numericPrincipal > 0 &&
    termMonths >= 1 &&
    typeof interestRatePct === "number" &&
    interestRatePct > 0;

  const handleSubmit = async () => {
    if (!customer) {
      toast.error("Selecciona un cliente");
      return;
    }
    if (!accountId) {
      toast.error("Selecciona una cuenta de origen");
      return;
    }
    if (numericRate <= 0) {
      toast.error("La tasa mensual es obligatoria");
      return;
    }

    setProcessing(true);
    try {
      const payload = {
        customerId: customer.id,
        principalAmount: numericPrincipal,
        termMonths,
        interestRate: numericRate,
        accountId,
        paymentMethod,
        originationFee: typeof originationFee === "number" && originationFee > 0 ? originationFee : undefined,
        collateral: collateral.trim() || undefined,
        notes: notes.trim() || undefined,
        firstDueDate: new Date(firstDueDate),
        idempotencyKey,
      };

      const res = await createLoanAction(payload);
      if (!res.success) {
        toast.error(res.error || "No se pudo desembolsar el préstamo");
        return;
      }

      toast.success(
        res.duplicate
          ? "El préstamo ya había sido procesado previamente"
          : "¡Préstamo desembolsado con éxito!"
      );
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      console.error(error);
      toast.error("Error inesperado al crear el préstamo");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="h-11 px-5 gap-2 font-medium shadow-sm">
          <Plus className="h-4 w-4" />
          Nuevo Préstamo
        </Button>
      </SheetTrigger>

      <SheetContent
        side="bottom"
        className="w-full sm:max-w-2xl sm:h-auto max-h-[92dvh] sm:max-h-[85vh] sm:rounded-2xl mx-auto flex flex-col p-0 overflow-hidden bg-background"
      >
        {/* Header con Stepper */}
        <div className="p-5 sm:p-6 border-b bg-card shrink-0">
          <SheetHeader className="text-left">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-xl font-bold flex items-center gap-2">
                <Landmark className="h-5 w-5 text-primary" />
                Desembolso de Préstamo
              </SheetTitle>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                <span className={step >= 1 ? "font-bold text-primary" : ""}>1. Cliente</span>
                <span>→</span>
                <span className={step >= 2 ? "font-bold text-primary" : ""}>2. Condiciones</span>
                <span>→</span>
                <span className={step >= 3 ? "font-bold text-primary" : ""}>3. Desembolso</span>
              </div>
            </div>
            <SheetDescription className="text-xs text-muted-foreground">
              {step === 1 && "Selecciona o registra el cliente beneficiario."}
              {step === 2 && "Define capital, plazo, tasa pactada y garantías."}
              {step === 3 && "Revisa la cuota calculada, cuenta de origen y confirma el desembolso."}
            </SheetDescription>
          </SheetHeader>
        </div>

        {/* Contenido con scroll */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* PASO 1: SELECCIÓN DE CLIENTE */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Cliente Beneficiario</Label>
                <CustomerSelector
                  selectedCustomer={customer}
                  onSelect={(c) => setCustomer(c)}
                />
              </div>

              {customer && (
                <div className="rounded-xl border bg-card/60 p-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-foreground">{customer.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      Seleccionado
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                    <div>
                      <span className="font-medium text-foreground">Documento:</span>{" "}
                      {customer.documentId || "No registrado"}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Teléfono:</span>{" "}
                      {customer.phone || "No registrado"}
                    </div>
                    {customer.email && (
                      <div className="col-span-full">
                        <span className="font-medium text-foreground">Email:</span> {customer.email}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PASO 2: CONDICIONES FINANCIERAS */}
          {step === 2 && (
            <div className="space-y-5">
              {/* Monto prestado */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Monto a Prestar (COP) *</Label>
                <MoneyInput
                  placeholder="Ej: 2,000,000"
                  value={principalAmount}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setPrincipalAmount(isNaN(val) ? "" : val);
                  }}
                  className="h-11 text-base font-bold"
                />
              </div>

              {/* Plazo en meses */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Plazo (Meses) *</Label>
                  <span className="text-xs text-muted-foreground">{termMonths} meses</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {COMMON_TERMS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setTermMonths(m)}
                      className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                        termMonths === m
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card hover:bg-muted text-foreground border-border"
                      }`}
                    >
                      {m} meses
                    </button>
                  ))}
                  <div className="w-24">
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      value={termMonths}
                      onChange={(e) => setTermMonths(Math.max(1, parseInt(e.target.value) || 1))}
                      className="h-11 text-center font-mono text-sm"
                      title="Plazo personalizado en meses"
                    />
                  </div>
                </div>
              </div>

              {/* Tasa mensual pactada (OBLIGATORIA SIN DEFAULT) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Percent className="h-4 w-4 text-primary" />
                    Tasa de Interés Mensual (%) *
                  </Label>
                  {typeof interestRatePct === "number" && interestRatePct > 0 ? (
                    <span className="text-xs font-mono text-primary font-bold">
                      {interestRatePct}% mensual
                    </span>
                  ) : (
                    <span className="text-xs text-destructive font-medium">Requerida</span>
                  )}
                </div>

                <div className="relative">
                  <Input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="100"
                    placeholder="Escribe la tasa pactada (ej. 5)"
                    value={interestRatePct}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setInterestRatePct(isNaN(val) ? "" : val);
                    }}
                    className={`h-11 font-mono text-base pr-8 ${
                      interestRatePct === "" ? "border-amber-400 focus-visible:ring-amber-400" : ""
                    }`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">
                    %
                  </span>
                </div>

                {/* Chips de sugerencia rápida (no pre-seleccionados) */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-muted-foreground">Frecuentes:</span>
                  {COMMON_RATES.map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => setInterestRatePct(rate)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                        interestRatePct === rate
                          ? "bg-accent text-accent-foreground border-accent font-bold"
                          : "bg-muted/40 hover:bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {rate}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Fecha primera cuota */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  Fecha de Primera Cuota *
                </Label>
                <Input
                  type="date"
                  value={firstDueDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setFirstDueDate(e.target.value)}
                  className="h-11"
                />
              </div>

              {/* Garantía / Codeudor */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  Garantía / Codeudor / Prenda (Opcional)
                </Label>
                <Input
                  placeholder="Ej: Letra de cambio firmada / Joya en custodia / Nombre codeudor"
                  value={collateral}
                  onChange={(e) => setCollateral(e.target.value)}
                  className="h-11"
                />
              </div>

              {/* Observaciones */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Notas u Observaciones (Opcional)</Label>
                <Textarea
                  placeholder="Comentarios adicionales del crédito..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="resize-none min-h-[70px]"
                />
              </div>
            </div>
          )}

          {/* PASO 3: REVISIÓN, CUENTA Y AMORTIZACIÓN */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Tarjetas de resumen del crédito */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl border bg-card">
                  <p className="text-xs text-muted-foreground">Capital a desembolsar</p>
                  <p className="text-base font-bold font-mono text-foreground mt-0.5">
                    {formatCurrency(numericPrincipal)}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border bg-card">
                  <p className="text-xs text-muted-foreground">Cuota mensual fija</p>
                  <p className="text-base font-bold font-mono text-primary mt-0.5">
                    {formatCurrency(fixedInstallment)}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border bg-card">
                  <p className="text-xs text-muted-foreground">Intereses totales</p>
                  <p className="text-base font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                    +{formatCurrency(totalInterestExpected)}
                  </p>
                </div>
              </div>

              {/* Cuenta de origen con saldo */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Cuenta de Caja de Origen *</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Selecciona la cuenta de desembolso" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name}{" "}
                        {acc.balance != null ? `(Saldo: ${formatCurrency(acc.balance)})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {hasInsufficientFunds && (
                  <div className="flex items-center gap-1.5 text-xs text-destructive font-medium pt-1">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>
                      La cuenta tiene saldo insuficiente ({formatCurrency(accountBalance)}). El
                      desembolso será rechazado por el servidor.
                    </span>
                  </div>
                )}
              </div>

              {/* Método de desembolso */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Método de Entrega del Dinero</Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(val) => setPaymentMethod(val as "cash" | "transfer" | "card")}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Efectivo en mano</SelectItem>
                    <SelectItem value="transfer">Transferencia bancaria</SelectItem>
                    <SelectItem value="card">Tarjeta / Procesador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Comisión de originación colapsable */}
              <Collapsible
                open={originationFeeOpen}
                onOpenChange={setOriginationFeeOpen}
                className="rounded-xl border bg-card/40 p-4 space-y-3"
              >
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer select-none">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Cobrar Comisión de Originación</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        Opcional
                      </span>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                        originationFeeOpen ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 pt-2">
                  <p className="text-xs text-muted-foreground">
                    Se registrará como un ingreso inmediato en caja y en el estado de ganancias bajo el concepto de comisión.
                  </p>
                  <MoneyInput
                    placeholder="Ej: 50,000"
                    value={originationFee}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setOriginationFee(isNaN(val) ? "" : val);
                    }}
                    className="h-11 font-mono"
                  />
                </CollapsibleContent>
              </Collapsible>

              {/* Tabla de amortización en vista previa */}
              <div className="space-y-2 pt-1">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Tabla de Amortización Francesa ({termMonths} cuotas)
                </h4>
                <AmortizationPreview schedule={schedule} installmentAmount={fixedInstallment} />
              </div>
            </div>
          )}
        </div>

        {/* Footer con botones táctiles y safe-area */}
        <div className="p-4 sm:p-5 border-t bg-card shrink-0 flex items-center justify-between gap-3 sticky bottom-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {step === 1 ? (
            <Button
              variant="outline"
              className="h-12 px-5"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
          ) : (
            <Button
              variant="outline"
              className="h-12 px-5 gap-2"
              onClick={() => setStep((s) => (s - 1) as 1 | 2)}
            >
              <ArrowLeft className="h-4 w-4" />
              Atrás
            </Button>
          )}

          {step === 1 && (
            <Button
              className="h-12 px-6 gap-2"
              disabled={!canGoToStep2}
              onClick={() => setStep(2)}
            >
              Continuar
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}

          {step === 2 && (
            <Button
              className="h-12 px-6 gap-2"
              disabled={!canGoToStep3}
              onClick={() => setStep(3)}
            >
              Revisar y Desembolsar
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}

          {step === 3 && (
            <Button
              className="h-12 px-6 gap-2 font-bold"
              disabled={processing || hasInsufficientFunds || !accountId}
              onClick={handleSubmit}
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Desembolsando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirmar Desembolso
                </>
              )}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
