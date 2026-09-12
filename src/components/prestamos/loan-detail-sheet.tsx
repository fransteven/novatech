"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/formatters";
import {
  getLoanDetailAction,
  cancelLoanAction,
  writeOffLoanAction,
} from "@/app/actions/loan-actions";
import { LoanStatusBadge } from "./loan-status-badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Calendar,
  DollarSign,
  User,
  Shield,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  CreditCard,
  Percent,
  History,
  Loader2,
} from "lucide-react";

interface CashAccount {
  id: string;
  name: string;
  balance?: number;
}

interface LoanDetailSheetProps {
  loanId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: CashAccount[];
  onOpenPayment: (loanId: string, scheduleNumber?: number) => void;
  onRefresh?: () => void;
}

export function LoanDetailSheet({
  loanId,
  open,
  onOpenChange,
  accounts,
  onOpenPayment,
  onRefresh,
}: LoanDetailSheetProps) {
  const [loading, setLoading] = useState(false);
  const [loanData, setLoanData] = useState<Awaited<ReturnType<typeof getLoanDetailAction>>["data"] | null>(null);

  // Modales de acciones críticas
  const [cancelOpen, setCancelOpen] = useState(false);
  const [writeOffOpen, setWriteOffOpen] = useState(false);
  const [writeOffReason, setWriteOffReason] = useState("");
  const [actionProcessing, setActionProcessing] = useState(false);

  useEffect(() => {
    if (!open || !loanId) return;

    setLoading(true);
    getLoanDetailAction(loanId).then((res) => {
      setLoading(false);
      if (res.success && res.data) {
        setLoanData(res.data);
      } else {
        toast.error("Error al cargar detalles del préstamo");
      }
    });
  }, [open, loanId]);

  const handleCancelLoan = async () => {
    if (!loanId) return;
    setActionProcessing(true);
    try {
      const res = await cancelLoanAction(loanId);
      if (!res.success) {
        toast.error(res.error || "No se pudo cancelar el préstamo");
        return;
      }
      toast.success("Préstamo cancelado exitosamente y desembolso revertido");
      setCancelOpen(false);
      onOpenChange(false);
      onRefresh?.();
    } catch (err) {
      console.error(err);
      toast.error("Error al cancelar préstamo");
    } finally {
      setActionProcessing(false);
    }
  };

  const handleWriteOffLoan = async () => {
    if (!loanId) return;
    if (writeOffReason.trim().length < 10) {
      toast.error("El motivo debe tener al menos 10 caracteres");
      return;
    }

    setActionProcessing(true);
    try {
      const res = await writeOffLoanAction({
        loanId,
        reason: writeOffReason.trim(),
      });
      if (!res.success) {
        toast.error(res.error || "No se pudo castigar la cartera");
        return;
      }
      toast.success("Préstamo castigado registrado en gastos");
      setWriteOffOpen(false);
      onOpenChange(false);
      onRefresh?.();
    } catch (err) {
      console.error(err);
      toast.error("Error al castigar préstamo");
    } finally {
      setActionProcessing(false);
    }
  };

  if (!loanData && loading) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="w-full sm:max-w-3xl sm:rounded-2xl mx-auto p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground mt-3">Cargando información del préstamo...</p>
        </SheetContent>
      </Sheet>
    );
  }

  if (!loanData) return null;

  const totalPaid = loanData.payments.reduce((s, p) => s + p.amount, 0);
  const totalPrincipalPaid = loanData.payments.reduce((s, p) => s + p.principalPortion, 0);
  const totalInterestPaid = loanData.payments.reduce((s, p) => s + p.interestPortion, 0);
  const canCancel = loanData.status === "active" && loanData.payments.length === 0;
  const canWriteOff = loanData.status === "active";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="w-full sm:max-w-3xl sm:h-auto max-h-[92dvh] sm:max-h-[88vh] sm:rounded-2xl mx-auto flex flex-col p-0 overflow-hidden bg-background"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b bg-card shrink-0">
            <SheetHeader className="text-left">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <SheetTitle className="text-xl font-bold">
                    Préstamo #{loanData.id.slice(0, 8).toUpperCase()}
                  </SheetTitle>
                  <LoanStatusBadge
                    status={loanData.status}
                    subStatus={loanData.subStatus}
                    riskLevel={loanData.riskLevel}
                    showRisk
                  />
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  Desembolso: {new Date(loanData.disbursedAt).toLocaleDateString("es-CO")}
                </div>
              </div>
              <SheetDescription className="text-xs text-muted-foreground flex items-center gap-1.5 pt-0.5">
                <User className="h-3.5 w-3.5 text-primary" />
                <strong>{loanData.customerName}</strong>
                {loanData.customerDocument && ` · C.C. ${loanData.customerDocument}`}
                {loanData.customerPhone && ` · Tel: ${loanData.customerPhone}`}
              </SheetDescription>
            </SheetHeader>
          </div>

          {/* Contenido con scroll */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            {/* KPI Cards de resumen financiero */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl border bg-card">
                <p className="text-xs text-muted-foreground">Capital Prestado</p>
                <p className="text-base font-bold font-mono text-foreground mt-0.5">
                  {formatCurrency(loanData.principalAmount)}
                </p>
              </div>
              <div className="p-3 rounded-xl border bg-card">
                <p className="text-xs text-muted-foreground">Saldo Insoluto</p>
                <p className="text-base font-bold font-mono text-primary mt-0.5">
                  {formatCurrency(loanData.outstandingPrincipal)}
                </p>
              </div>
              <div className="p-3 rounded-xl border bg-card">
                <p className="text-xs text-muted-foreground">Tasa Pactada</p>
                <p className="text-base font-bold font-mono text-foreground mt-0.5">
                  {(loanData.interestRate * 100).toFixed(1)}% mes
                </p>
              </div>
              <div className="p-3 rounded-xl border bg-card">
                <p className="text-xs text-muted-foreground">Cuota Fija</p>
                <p className="text-base font-bold font-mono text-foreground mt-0.5">
                  {formatCurrency(loanData.installmentAmount)}
                </p>
              </div>
            </div>

            {/* Recaudado y Comisión */}
            <div className="p-4 rounded-xl border bg-card/60 text-xs text-muted-foreground space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>Total recaudado histórico:</span>
                <span className="font-bold font-mono text-foreground text-sm">
                  {formatCurrency(totalPaid)}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 border-t">
                <div>Capital recuperado: {formatCurrency(totalPrincipalPaid)}</div>
                <div className="text-amber-600 dark:text-amber-400">
                  Intereses cobrados: {formatCurrency(totalInterestPaid)}
                </div>
                {loanData.originationFee > 0 && (
                  <div className="text-emerald-600 dark:text-emerald-400">
                    Comisión inicial: {formatCurrency(loanData.originationFee)}
                  </div>
                )}
              </div>
            </div>

            {/* Garantía y Notas si existen */}
            {(loanData.collateral || loanData.notes) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {loanData.collateral && (
                  <div className="p-3 rounded-xl border bg-card space-y-1">
                    <p className="font-semibold text-foreground flex items-center gap-1">
                      <Shield className="h-3.5 w-3.5 text-primary" />
                      Garantía / Codeudor
                    </p>
                    <p className="text-muted-foreground">{loanData.collateral}</p>
                  </div>
                )}
                {loanData.notes && (
                  <div className="p-3 rounded-xl border bg-card space-y-1">
                    <p className="font-semibold text-foreground flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5 text-primary" />
                      Observaciones
                    </p>
                    <p className="text-muted-foreground">{loanData.notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* CRONOGRAMA DE CUOTAS */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold tracking-tight uppercase text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  Cronograma de Pagos ({loanData.schedule.length} cuotas)
                </h3>
              </div>

              {/* Vista Móvil: Tarjetas por cuota */}
              <div className="block sm:hidden space-y-2">
                {loanData.schedule.map((entry) => {
                  const isPending = entry.status !== "pagada";
                  return (
                    <div
                      key={entry.number}
                      className={`p-3.5 rounded-xl border space-y-2 ${
                        entry.status === "vencida"
                          ? "bg-amber-500/5 border-amber-300 dark:border-amber-900/50"
                          : entry.status === "pagada"
                          ? "bg-muted/30 border-border opacity-70"
                          : "bg-card border-border"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">Cuota #{entry.number}</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              entry.status === "pagada"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : entry.status === "vencida"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                            }`}
                          >
                            {entry.status}
                          </span>
                        </div>
                        <span className="font-bold font-mono text-sm text-foreground">
                          {formatCurrency(entry.totalAmount)}
                        </span>
                      </div>

                      <div className="text-xs text-muted-foreground grid grid-cols-2 gap-1 pt-1 border-t">
                        <div>
                          Vence: {new Date(entry.dueDate).toLocaleDateString("es-CO")}
                        </div>
                        <div className="text-right">
                          Capital: {formatCurrency(entry.principal)}
                        </div>
                        <div>Interés: {formatCurrency(entry.interest)}</div>
                        <div className="text-right">
                          Saldo restante: {formatCurrency(entry.remainingBalance)}
                        </div>
                      </div>

                      {isPending && loanData.status === "active" && (
                        <Button
                          size="sm"
                          className="w-full h-10 mt-1 text-xs font-semibold"
                          onClick={() => {
                            onOpenChange(false);
                            onOpenPayment(loanData.id, entry.number);
                          }}
                        >
                          Registrar Pago de Cuota #{entry.number}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Vista Desktop: Tabla compacta */}
              <div className="hidden sm:block rounded-xl border overflow-hidden">
                <table className="w-full text-xs caption-bottom text-left">
                  <thead className="bg-muted/40 border-b">
                    <tr className="font-medium text-muted-foreground">
                      <th className="p-2.5 pl-3">#</th>
                      <th className="p-2.5">Vencimiento</th>
                      <th className="p-2.5 text-right">Capital</th>
                      <th className="p-2.5 text-right">Interés</th>
                      <th className="p-2.5 text-right">Cuota Total</th>
                      <th className="p-2.5 text-right">Saldo Restante</th>
                      <th className="p-2.5 text-center">Estado</th>
                      <th className="p-2.5 pr-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {loanData.schedule.map((entry) => (
                      <tr
                        key={entry.number}
                        className={entry.status === "pagada" ? "opacity-60 bg-muted/20" : ""}
                      >
                        <td className="p-2.5 pl-3 font-medium">{entry.number}</td>
                        <td className="p-2.5">
                          {new Date(entry.dueDate).toLocaleDateString("es-CO")}
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          {formatCurrency(entry.principal)}
                        </td>
                        <td className="p-2.5 text-right font-mono text-amber-600 dark:text-amber-400">
                          {formatCurrency(entry.interest)}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold">
                          {formatCurrency(entry.totalAmount)}
                        </td>
                        <td className="p-2.5 text-right font-mono text-muted-foreground">
                          {formatCurrency(entry.remainingBalance)}
                        </td>
                        <td className="p-2.5 text-center">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              entry.status === "pagada"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : entry.status === "vencida"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                            }`}
                          >
                            {entry.status}
                          </span>
                        </td>
                        <td className="p-2.5 pr-3 text-right">
                          {entry.status !== "pagada" && loanData.status === "active" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs text-primary hover:text-primary font-medium"
                              onClick={() => {
                                onOpenChange(false);
                                onOpenPayment(loanData.id, entry.number);
                              }}
                            >
                              Pagar
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">
                              {entry.paidAt ? new Date(entry.paidAt).toLocaleDateString("es-CO") : "—"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* HISTORIAL DE PAGOS */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold tracking-tight uppercase text-muted-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" />
                Historial de Pagos Recibidos ({loanData.payments.length})
              </h3>

              {loanData.payments.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground border rounded-xl bg-card">
                  No hay pagos registrados aún en este préstamo.
                </div>
              ) : (
                <div className="rounded-xl border overflow-hidden divide-y text-xs">
                  {loanData.payments.map((p) => (
                    <div key={p.id} className="p-3 bg-card flex items-center justify-between gap-2">
                      <div>
                        <span className="font-semibold text-foreground">
                          {p.type === "cuota"
                            ? `Cuota #${p.scheduleNumber}`
                            : p.type === "solo_interes"
                            ? `Solo Interés Cuota #${p.scheduleNumber}`
                            : p.type === "abono_capital"
                            ? `Abono a Capital (${p.capitalStrategy === "reduce_term" ? "Menos plazo" : "Menor cuota"})`
                            : `Abono parcial Cuota #${p.scheduleNumber}`}
                        </span>
                        <div className="text-muted-foreground text-[11px] mt-0.5">
                          {new Date(p.createdAt).toLocaleString("es-CO")} · Registrado por {p.createdByName ?? "Usuario"}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold font-mono text-sm text-foreground">
                          {formatCurrency(p.amount)}
                        </span>
                        <div className="text-[11px] text-muted-foreground">
                          Cap: {formatCurrency(p.principalPortion)} · Int: {formatCurrency(p.interestPortion)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer con Acciones */}
          <div className="p-4 sm:p-5 border-t bg-card shrink-0 flex flex-wrap items-center justify-between gap-2 sticky bottom-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center gap-2">
              {canCancel && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 text-xs text-destructive hover:bg-destructive/10"
                  onClick={() => setCancelOpen(true)}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Cancelar Préstamo
                </Button>
              )}

              {canWriteOff && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 text-xs text-amber-600 hover:bg-amber-500/10"
                  onClick={() => setWriteOffOpen(true)}
                >
                  <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                  Castigar Cartera
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="h-11 px-4 text-xs"
                onClick={() => onOpenChange(false)}
              >
                Cerrar
              </Button>

              {loanData.status === "active" && (
                <Button
                  className="h-11 px-5 text-xs font-bold gap-1.5"
                  onClick={() => {
                    onOpenChange(false);
                    onOpenPayment(loanData.id);
                  }}
                >
                  <DollarSign className="h-4 w-4" />
                  Registrar Cobro
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Confirmación de Cancelación */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent className="max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar este préstamo?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground space-y-2">
              <p>
                Esta acción marcará el préstamo como cancelado y revertirá el movimiento de egreso
                en la caja registradora.
              </p>
              <p className="font-semibold text-destructive">
                Solo es posible si no se ha recibido ningún pago.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionProcessing}>No, volver</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={actionProcessing}
              onClick={handleCancelLoan}
            >
              {actionProcessing ? "Cancelando..." : "Sí, cancelar préstamo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmación de Castigo de Cartera */}
      <AlertDialog open={writeOffOpen} onOpenChange={setWriteOffOpen}>
        <AlertDialogContent className="max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Castigar Cartera (Default)</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground space-y-3">
              <p>
                Se declarará el préstamo como incobrable. El saldo insoluto actual (
                <strong>{formatCurrency(loanData.outstandingPrincipal)}</strong>) será registrado como
                gasto operativo bajo la categoría "Cartera castigada".
              </p>
              <div className="space-y-1 text-left pt-1">
                <Label className="text-xs font-semibold text-foreground">
                  Motivo de la pérdida (mínimo 10 caracteres) *
                </Label>
                <Input
                  placeholder="Ej: Cliente ilocalizable tras 90 días en mora..."
                  value={writeOffReason}
                  onChange={(e) => setWriteOffReason(e.target.value)}
                  className="h-10 text-xs"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionProcessing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={actionProcessing || writeOffReason.trim().length < 10}
              onClick={handleWriteOffLoan}
            >
              {actionProcessing ? "Procesando..." : "Confirmar Castigo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
