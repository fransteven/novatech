"use client";

import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { formatCurrency } from "@/lib/formatters";
import { registerCreditPaymentAction, getLayawayDetailsAction } from "@/app/actions/layaway-actions";
import { toast } from "sonner";
import { DollarSign, Info } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type CashAccount = { id: string; name: string };

interface CreditPaymentDialogProps {
  layawayId: string | null;
  outstandingPrincipal: number;
  installmentAmount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  accounts: CashAccount[];
}

interface ScheduleRow {
  number: number;
  totalAmount: string | number;
  paidAmount: string | number;
  status: string;
}

export function CreditPaymentDialog({
  layawayId,
  outstandingPrincipal,
  installmentAmount,
  open,
  onOpenChange,
  onSuccess,
  accounts,
}: CreditPaymentDialogProps) {
  const [processing, setProcessing] = useState(false);
  const [tab, setTab] = useState<"cuota" | "solo_interes" | "abono_capital" | "abono_cuota">("cuota");

  // Cuota normal
  const [scheduleNumber, setScheduleNumber] = useState<number | "">("");

  // Solo interés (el monto lo lee del cronograma — se pasa por UI por simplicidad)
  const [soloInteresScheduleNum, setSoloInteresScheduleNum] = useState<number | "">("");
  const [soloInteresAmount, setSoloInteresAmount] = useState<number | "">("");

  // Abono a capital
  const [capitalAmount, setCapitalAmount] = useState<number | "">("");
  const [capitalStrategy, setCapitalStrategy] = useState<"reduce_term" | "reduce_installment">("reduce_term");

  // Abono a una cuota (parcial, no cambia el cronograma)
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [abonoCuotaNum, setAbonoCuotaNum] = useState<number | "">("");
  const [abonoCuotaAmount, setAbonoCuotaAmount] = useState<number | "">("");

  // Comunes
  const [method, setMethod] = useState("cash");
  const [accountId, setAccountId] = useState("");
  const [referenceCode, setReferenceCode] = useState("");

  const resetForm = () => {
    setScheduleNumber("");
    setSoloInteresScheduleNum("");
    setSoloInteresAmount("");
    setCapitalAmount("");
    setCapitalStrategy("reduce_term");
    setAbonoCuotaNum("");
    setAbonoCuotaAmount("");
    setMethod("cash");
    setAccountId("");
    setReferenceCode("");
  };

  // Al abrir el diálogo o entrar a la tab "Abono cuota", carga el cronograma
  // y sugiere por defecto la primera cuota pendiente (la "siguiente cuota").
  useEffect(() => {
    if (!open || !layawayId || tab !== "abono_cuota") return;
    let active = true;
    getLayawayDetailsAction(layawayId).then((res) => {
      if (!active || !res.success || !res.data) return;
      const rows = (res.data.schedule ?? []) as ScheduleRow[];
      setSchedule(rows);
      const nextPending = rows.find((r) => r.status !== "pagada");
      if (nextPending && !abonoCuotaNum) setAbonoCuotaNum(nextPending.number);
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, layawayId, tab]);

  const selectedCuota = schedule.find((r) => r.number === abonoCuotaNum);
  const cuotaTotal = selectedCuota ? Number(selectedCuota.totalAmount) : 0;
  const cuotaPaid = selectedCuota ? Number(selectedCuota.paidAmount) : 0;
  const cuotaRemaining = Math.max(cuotaTotal - cuotaPaid, 0);
  const cuotaAfterAbono = Math.max(cuotaRemaining - Number(abonoCuotaAmount || 0), 0);

  const handleSubmit = async () => {
    if (!layawayId) return;
    if (!accountId) { toast.error("Selecciona una cuenta"); return; }

    let payload: Record<string, unknown> = {
      layawayId,
      type: tab,
      paymentMethod: method,
      accountId,
      referenceCode: referenceCode || undefined,
      idempotencyKey: uuidv4(),
    };

    if (tab === "cuota") {
      if (!scheduleNumber) { toast.error("Ingresa el número de cuota"); return; }
      payload = { ...payload, amount: installmentAmount, scheduleNumber: Number(scheduleNumber) };
    } else if (tab === "solo_interes") {
      if (!soloInteresScheduleNum || !soloInteresAmount || Number(soloInteresAmount) <= 0) {
        toast.error("Ingresa el número de cuota y el monto de interés");
        return;
      }
      payload = { ...payload, amount: Number(soloInteresAmount), scheduleNumber: Number(soloInteresScheduleNum) };
    } else if (tab === "abono_cuota") {
      if (!abonoCuotaNum) { toast.error("Selecciona el número de cuota"); return; }
      if (!abonoCuotaAmount || Number(abonoCuotaAmount) <= 0) { toast.error("Ingresa el monto del abono"); return; }
      if (Number(abonoCuotaAmount) > cuotaRemaining) {
        toast.error(`El abono no puede superar el saldo de la cuota (${formatCurrency(cuotaRemaining)})`);
        return;
      }
      payload = { ...payload, amount: Number(abonoCuotaAmount), scheduleNumber: Number(abonoCuotaNum) };
    } else if (tab === "abono_capital") {
      if (!capitalAmount || Number(capitalAmount) <= 0) { toast.error("Ingresa el monto del abono"); return; }
      if (Number(capitalAmount) >= outstandingPrincipal) {
        toast.error("El abono a capital no puede igualar o superar el saldo insoluto. Usa 'Cuota' para liquidar.");
        return;
      }
      payload = { ...payload, amount: Number(capitalAmount), capitalStrategy };
    }

    setProcessing(true);
    try {
      const res = await registerCreditPaymentAction(payload);
      if (res.success) {
        toast.success(
          res.duplicate
            ? "Este pago ya había sido registrado"
            : tab === "cuota"
            ? "Cuota registrada exitosamente"
            : tab === "solo_interes"
            ? "Pago de solo interés registrado. La cuota sigue pendiente."
            : tab === "abono_cuota"
            ? cuotaAfterAbono <= 0
              ? "Abono registrado. Cuota completada."
              : `Abono registrado. Falta ${formatCurrency(cuotaAfterAbono)} para completar la cuota.`
            : "Abono a capital aplicado. Cronograma regenerado."
        );
        resetForm();
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error("Error al registrar el pago", { description: res.error });
      }
    } catch {
      toast.error("Error crítico al procesar el pago");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-4 sm:p-6 sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Registrar Pago de Crédito</DialogTitle>
          <DialogDescription>
            Saldo insoluto actual:{" "}
            <strong className="text-primary">{formatCurrency(outstandingPrincipal)}</strong>
            {installmentAmount > 0 && (
              <> · Cuota: <strong>{formatCurrency(installmentAmount)}</strong></>
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="cuota" className="text-xs sm:text-sm">Cuota normal</TabsTrigger>
            <TabsTrigger value="solo_interes" className="text-xs sm:text-sm">Solo interés</TabsTrigger>
            <TabsTrigger value="abono_cuota" className="text-xs sm:text-sm">Abono cuota</TabsTrigger>
            <TabsTrigger value="abono_capital" className="text-xs sm:text-sm">Abono capital</TabsTrigger>
          </TabsList>

          {/* Cuota normal */}
          <TabsContent value="cuota" className="space-y-4 pt-3">
            <p className="text-sm text-muted-foreground">
              Registra el pago completo de una cuota del cronograma ({formatCurrency(installmentAmount)}).
            </p>
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
              <Label className="sm:w-32 sm:text-right">Número de cuota</Label>
              <Input
                type="number"
                min="1"
                placeholder="Ej: 3"
                value={scheduleNumber}
                onChange={(e) => setScheduleNumber(Number(e.target.value) || "")}
                className="flex-1"
              />
            </div>
          </TabsContent>

          {/* Solo interés */}
          <TabsContent value="solo_interes" className="space-y-4 pt-3">
            <div className="flex gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded text-sm text-yellow-800 dark:text-yellow-300">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>La cuota <strong>NO avanza</strong> — el cliente solo paga el interés del periodo. El próximo mes vuelve a deber capital + interés de esa misma cuota.</span>
            </div>
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
              <Label className="sm:w-32 sm:text-right">Número de cuota</Label>
              <Input
                type="number"
                min="1"
                placeholder="Ej: 5"
                value={soloInteresScheduleNum}
                onChange={(e) => setSoloInteresScheduleNum(Number(e.target.value) || "")}
                className="flex-1"
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
              <Label className="sm:w-32 sm:text-right">Monto interés</Label>
              <div className="relative flex-1">
                <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  min="1"
                  placeholder="Interés del periodo"
                  value={soloInteresAmount}
                  onChange={(e) => setSoloInteresAmount(Number(e.target.value) || "")}
                  className="pl-8"
                />
              </div>
            </div>
          </TabsContent>

          {/* Abono a una cuota (parcial, no cambia el cronograma) */}
          <TabsContent value="abono_cuota" className="space-y-4 pt-3">
            <p className="text-sm text-muted-foreground">
              Abona una parte de una cuota pendiente. El cronograma <strong>no cambia</strong>;
              la cuota sigue pendiente hasta completar su valor total.
            </p>
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
              <Label className="sm:w-32 sm:text-right">Número de cuota</Label>
              <Input
                type="number"
                min="1"
                placeholder="Ej: 1"
                value={abonoCuotaNum}
                onChange={(e) => setAbonoCuotaNum(Number(e.target.value) || "")}
                className="flex-1"
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
              <Label className="sm:w-32 sm:text-right">Monto a abonar</Label>
              <div className="relative flex-1">
                <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  min="1"
                  max={cuotaRemaining || undefined}
                  placeholder="Monto a abonar"
                  value={abonoCuotaAmount}
                  onChange={(e) => setAbonoCuotaAmount(Number(e.target.value) || "")}
                  className="pl-8"
                />
              </div>
            </div>
            {selectedCuota && (
              <div className="text-sm bg-muted/30 p-2 rounded space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cuota total</span>
                  <span>{formatCurrency(cuotaTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Abonado</span>
                  <span>{formatCurrency(cuotaPaid)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Falta {abonoCuotaAmount ? "(luego de este abono)" : ""}</span>
                  <span className="text-primary">
                    {formatCurrency(abonoCuotaAmount ? cuotaAfterAbono : cuotaRemaining)}
                  </span>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Abono a capital */}
          <TabsContent value="abono_capital" className="space-y-4 pt-3">
            <p className="text-sm text-muted-foreground">
              Reduce el saldo insoluto y regenera el cronograma.
            </p>
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
              <Label className="sm:w-32 sm:text-right">Monto abono</Label>
              <div className="relative flex-1">
                <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  min="1"
                  max={outstandingPrincipal - 1}
                  placeholder="Monto a abonar"
                  value={capitalAmount}
                  onChange={(e) => setCapitalAmount(Number(e.target.value) || "")}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
              <Label className="sm:w-32 sm:text-right">Estrategia</Label>
              <Select value={capitalStrategy} onValueChange={(v) => setCapitalStrategy(v as typeof capitalStrategy)}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reduce_term">
                    Reducir plazo (misma cuota, menos meses)
                  </SelectItem>
                  <SelectItem value="reduce_installment">
                    Reducir cuota (mismo plazo, cuota menor)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
        </Tabs>

        {/* Campos comunes */}
        <div className="space-y-4 pt-2 border-t">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
            <Label className="sm:w-32 sm:text-right">Método</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Efectivo</SelectItem>
                <SelectItem value="transfer">Transferencia</SelectItem>
                <SelectItem value="card">Tarjeta / Datáfono</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
            <Label className="sm:w-32 sm:text-right">Cuenta</Label>
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
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
            <Label className="sm:w-32 sm:text-right">Referencia</Label>
            <Input
              placeholder="Opcional"
              value={referenceCode}
              onChange={(e) => setReferenceCode(e.target.value)}
              className="flex-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={processing}>
            {processing ? "Procesando..." : "Registrar Pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
