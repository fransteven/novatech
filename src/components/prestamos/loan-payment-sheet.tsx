"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/formatters";
import { registerLoanPaymentAction, getLoanDetailAction } from "@/app/actions/loan-actions";
import { toast } from "sonner";
import { DollarSign, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type CashAccount = { id: string; name: string; balance?: number };

interface LoanPaymentSheetProps {
  loanId: string | null;
  outstandingPrincipal: number;
  installmentAmount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  accounts: CashAccount[];
  initialScheduleNumber?: number;
}

interface ScheduleRow {
  number: number;
  totalAmount: number;
  paidAmount: number;
  principal: number;
  interest: number;
  status: string;
}

export function LoanPaymentSheet({
  loanId,
  outstandingPrincipal,
  installmentAmount,
  open,
  onOpenChange,
  onSuccess,
  accounts,
  initialScheduleNumber,
}: LoanPaymentSheetProps) {
  const [processing, setProcessing] = useState(false);
  const [tab, setTab] = useState<"cuota" | "solo_interes" | "abono_capital" | "abono_cuota">("cuota");

  // Idempotencia: generada al abrir el sheet
  const [idempotencyKey, setIdempotencyKey] = useState("");

  // Cronograma cargado
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  // Cuota normal
  const [scheduleNumber, setScheduleNumber] = useState<number | "">("");

  // Solo interés
  const [soloInteresScheduleNum, setSoloInteresScheduleNum] = useState<number | "">("");

  // Abono a capital
  const [capitalAmount, setCapitalAmount] = useState<number | null>(null);
  const [capitalStrategy, setCapitalStrategy] = useState<"reduce_term" | "reduce_installment">("reduce_term");

  // Abono parcial a cuota
  const [abonoCuotaNum, setAbonoCuotaNum] = useState<number | "">("");
  const [abonoCuotaAmount, setAbonoCuotaAmount] = useState<number | null>(null);

  // Campos comunes
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer" | "card">("cash");
  const [accountId, setAccountId] = useState("");
  const [referenceCode, setReferenceCode] = useState("");
  const [notes, setNotes] = useState("");

  // Cargar cronograma y generar idempotencyKey al abrir
  useEffect(() => {
    if (!open || !loanId) return;

    setIdempotencyKey(crypto.randomUUID());
    if (accounts.length > 0 && !accountId) {
      setAccountId(accounts[0].id);
    }

    setLoadingSchedule(true);
    getLoanDetailAction(loanId).then((res) => {
      setLoadingSchedule(false);
      if (res.success && res.data) {
        const rows = (res.data.schedule ?? []) as ScheduleRow[];
        setSchedule(rows);

        // Preseleccionar cuota sugerida
        const targetNumber =
          initialScheduleNumber ??
          rows.find((r) => r.status !== "pagada")?.number ??
          "";

        setScheduleNumber(targetNumber);
        setSoloInteresScheduleNum(targetNumber);
        setAbonoCuotaNum(targetNumber);
      }
    });
  }, [open, loanId, initialScheduleNumber, accounts, accountId]);

  // Datos de la cuota seleccionada en cuota normal
  const selectedCuota = schedule.find((r) => r.number === scheduleNumber);
  const cuotaTotal = selectedCuota ? selectedCuota.totalAmount : installmentAmount;

  // Datos de solo interés
  const selectedSoloInteresCuota = schedule.find((r) => r.number === soloInteresScheduleNum);
  const soloInteresAmount = selectedSoloInteresCuota ? selectedSoloInteresCuota.interest : 0;

  // Datos de abono parcial
  const selectedAbonoCuota = schedule.find((r) => r.number === abonoCuotaNum);
  const abonoCuotaTotal = selectedAbonoCuota ? selectedAbonoCuota.totalAmount : 0;
  const abonoCuotaPaid = selectedAbonoCuota ? selectedAbonoCuota.paidAmount : 0;
  const abonoCuotaRemaining = Math.max(abonoCuotaTotal - abonoCuotaPaid, 0);

  const handleSubmit = async () => {
    if (!loanId) return;
    if (!accountId) {
      toast.error("Selecciona una cuenta receptora del dinero");
      return;
    }

    let payload: Record<string, unknown> = {
      loanId,
      type: tab,
      paymentMethod,
      accountId,
      referenceCode: referenceCode.trim() || undefined,
      notes: notes.trim() || undefined,
      idempotencyKey,
    };

    if (tab === "cuota") {
      if (!scheduleNumber) {
        toast.error("Selecciona la cuota a pagar");
        return;
      }
      payload = {
        ...payload,
        scheduleNumber: Number(scheduleNumber),
        amount: cuotaTotal,
      };
    } else if (tab === "solo_interes") {
      if (!soloInteresScheduleNum) {
        toast.error("Selecciona la cuota de interés a pagar");
        return;
      }
      if (soloInteresAmount <= 0) {
        toast.error("El monto de interés no es válido");
        return;
      }
      payload = {
        ...payload,
        scheduleNumber: Number(soloInteresScheduleNum),
        amount: soloInteresAmount,
      };
    } else if (tab === "abono_capital") {
      if (typeof capitalAmount !== "number" || capitalAmount <= 0) {
        toast.error("Ingresa un monto positivo para el abono a capital");
        return;
      }
      if (capitalAmount >= outstandingPrincipal) {
        toast.error(
          "El abono a capital no puede ser mayor o igual al saldo insoluto. Usa 'Pagar Cuota' para saldarlo."
        );
        return;
      }
      payload = {
        ...payload,
        amount: capitalAmount,
        capitalStrategy,
      };
    } else if (tab === "abono_cuota") {
      if (!abonoCuotaNum) {
        toast.error("Selecciona la cuota");
        return;
      }
      if (typeof abonoCuotaAmount !== "number" || abonoCuotaAmount <= 0) {
        toast.error("Ingresa el monto del abono");
        return;
      }
      if (abonoCuotaAmount > abonoCuotaRemaining) {
        toast.error(
          `El abono no puede superar el saldo pendiente de la cuota (${formatCurrency(
            abonoCuotaRemaining
          )})`
        );
        return;
      }
      payload = {
        ...payload,
        scheduleNumber: Number(abonoCuotaNum),
        amount: abonoCuotaAmount,
      };
    }

    setProcessing(true);
    try {
      const res = await registerLoanPaymentAction(payload);
      if (!res.success) {
        toast.error(res.error || "No se pudo registrar el pago");
        return;
      }

      toast.success(
        res.duplicate
          ? "Este pago ya había sido procesado previamente"
          : "¡Pago registrado correctamente!"
      );
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error(error);
      toast.error("Error al registrar el pago");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="w-full sm:max-w-xl sm:h-auto max-h-[92dvh] sm:max-h-[85vh] sm:rounded-2xl mx-auto flex flex-col p-0 overflow-hidden bg-background"
      >
        <div className="p-5 sm:p-6 border-b bg-card shrink-0">
          <SheetHeader className="text-left">
            <SheetTitle className="text-xl font-bold flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Registrar Cobro de Préstamo
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              Saldo insoluto:{" "}
              <strong className="text-foreground font-mono">
                {formatCurrency(outstandingPrincipal)}
              </strong>{" "}
              · Cuota fija regular:{" "}
              <strong className="text-foreground font-mono">
                {formatCurrency(installmentAmount)}
              </strong>
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          <Tabs
            value={tab}
            onValueChange={(val) => setTab(val as typeof tab)}
            className="w-full"
          >
            <TabsList className="grid grid-cols-2 sm:grid-cols-4 h-auto p-1 bg-muted rounded-xl gap-1">
              <TabsTrigger value="cuota" className="text-xs py-2 rounded-lg">
                Cuota normal
              </TabsTrigger>
              <TabsTrigger value="solo_interes" className="text-xs py-2 rounded-lg">
                Solo interés
              </TabsTrigger>
              <TabsTrigger value="abono_capital" className="text-xs py-2 rounded-lg">
                Abono capital
              </TabsTrigger>
              <TabsTrigger value="abono_cuota" className="text-xs py-2 rounded-lg">
                Abono a cuota
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: CUOTA NORMAL */}
            <TabsContent value="cuota" className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Cuota a Pagar *</Label>
                <Select
                  value={scheduleNumber ? String(scheduleNumber) : ""}
                  onValueChange={(val) => setScheduleNumber(Number(val))}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Selecciona una cuota" />
                  </SelectTrigger>
                  <SelectContent>
                    {schedule.map((c) => (
                      <SelectItem key={c.number} value={String(c.number)}>
                        Cuota #{c.number} — {formatCurrency(c.totalAmount)}{" "}
                        {c.status === "pagada"
                          ? "(Ya pagada)"
                          : c.status === "vencida"
                          ? "(Vencida)"
                          : "(Pendiente)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedCuota && (
                <div className="p-4 rounded-xl border bg-card/60 space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-xs">Monto total a cobrar:</span>
                    <span className="font-bold text-base font-mono text-primary">
                      {formatCurrency(selectedCuota.totalAmount)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground grid grid-cols-2 pt-1 border-t">
                    <span>Abono a capital: {formatCurrency(selectedCuota.principal)}</span>
                    <span className="text-right text-amber-600 dark:text-amber-400">
                      Interés: {formatCurrency(selectedCuota.interest)}
                    </span>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* TAB 2: SOLO INTERÉS */}
            <TabsContent value="solo_interes" className="space-y-4 pt-4">
              <div className="p-3.5 rounded-xl border bg-amber-500/10 border-amber-500/20 text-xs text-amber-900 dark:text-amber-200">
                El cliente cancela únicamente los intereses devengados del mes. El capital no se reduce
                y la cuota permanece pendiente para el próximo período.
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Seleccionar Cuota del Período *</Label>
                <Select
                  value={soloInteresScheduleNum ? String(soloInteresScheduleNum) : ""}
                  onValueChange={(val) => setSoloInteresScheduleNum(Number(val))}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Selecciona la cuota" />
                  </SelectTrigger>
                  <SelectContent>
                    {schedule
                      .filter((c) => c.status !== "pagada")
                      .map((c) => (
                        <SelectItem key={c.number} value={String(c.number)}>
                          Cuota #{c.number} — Interés: {formatCurrency(c.interest)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedSoloInteresCuota && (
                <div className="p-4 rounded-xl border bg-card/60 flex justify-between items-center text-sm">
                  <span className="text-xs text-muted-foreground">Interés a cobrar:</span>
                  <span className="font-bold text-base font-mono text-amber-600 dark:text-amber-400">
                    {formatCurrency(selectedSoloInteresCuota.interest)}
                  </span>
                </div>
              )}
            </TabsContent>

            {/* TAB 3: ABONO A CAPITAL */}
            <TabsContent value="abono_capital" className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Monto del Abono a Capital (COP) *</Label>
                <MoneyInput
                  placeholder="Ej: 500,000"
                  value={capitalAmount}
                  onValueChange={setCapitalAmount}
                  className="h-11 font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  Saldo insoluto actual: {formatCurrency(outstandingPrincipal)}. El 100% del abono reduce el saldo de deuda.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Estrategia de Recálculo Francés *</Label>
                <Select
                  value={capitalStrategy}
                  onValueChange={(val) => setCapitalStrategy(val as typeof capitalStrategy)}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reduce_term">
                      Reducir plazo (mantener cuota similar, terminar antes)
                    </SelectItem>
                    <SelectItem value="reduce_installment">
                      Reducir cuota (mismo plazo, pagar cuota mensual más baja)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            {/* TAB 4: ABONO A CUOTA */}
            <TabsContent value="abono_cuota" className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Cuota a Abonar *</Label>
                <Select
                  value={abonoCuotaNum ? String(abonoCuotaNum) : ""}
                  onValueChange={(val) => setAbonoCuotaNum(Number(val))}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Selecciona una cuota" />
                  </SelectTrigger>
                  <SelectContent>
                    {schedule
                      .filter((c) => c.status !== "pagada")
                      .map((c) => (
                        <SelectItem key={c.number} value={String(c.number)}>
                          Cuota #{c.number} — Saldo: {formatCurrency(c.totalAmount - c.paidAmount)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Monto Parcial a Abonar (COP) *</Label>
                <MoneyInput
                  placeholder={`Máx: ${formatCurrency(abonoCuotaRemaining)}`}
                  value={abonoCuotaAmount}
                  onValueChange={setAbonoCuotaAmount}
                  className="h-11 font-mono"
                />
                {selectedAbonoCuota && (
                  <p className="text-[11px] text-muted-foreground">
                    Restante en la cuota: {formatCurrency(abonoCuotaRemaining)}
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* CAMPOS COMUNES DE PAGO */}
          <div className="space-y-4 pt-4 border-t">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Cuenta de Entrada *</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Selecciona una cuenta" />
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
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Método de Cobro</Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(val) => setPaymentMethod(val as "cash" | "transfer" | "card")}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Efectivo</SelectItem>
                    <SelectItem value="transfer">Transferencia</SelectItem>
                    <SelectItem value="card">Tarjeta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Código de Referencia (Opcional)</Label>
                <Input
                  placeholder="Ej: #123456 comprobante"
                  value={referenceCode}
                  onChange={(e) => setReferenceCode(e.target.value)}
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Observaciones (Opcional)</Label>
                <Input
                  placeholder="Detalles del pago..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-11"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 border-t bg-card shrink-0 flex items-center justify-between gap-3 sticky bottom-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button
            variant="outline"
            className="h-12 px-5"
            onClick={() => onOpenChange(false)}
          >
            Cerrar
          </Button>

          <Button
            className="h-12 px-6 gap-2 font-bold"
            disabled={processing || loadingSchedule || !accountId}
            onClick={handleSubmit}
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Registrando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Registrar Pago
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
