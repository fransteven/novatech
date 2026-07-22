"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { getLayawayDetailsAction } from "@/app/actions/layaway-actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface LayawayDetailsDialogProps {
  layawayId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerName: string | null;
  layawayType?: string;
}

interface LayawayItem {
  id: string;
  productName: string;
  quantity: number;
  serialNumber?: string;
  agreedPrice: string | number;
}

interface LayawayPayment {
  id: string;
  createdAt: string | Date;
  method: string;
  notes?: string;
  amount: string | number;
}

interface ScheduleEntry {
  id: string;
  number: number;
  dueDate: string | Date;
  principal: string | number;
  interest: string | number;
  totalAmount: string | number;
  remainingBalance: string | number;
  status: string;
  paidAt?: string | Date | null;
  paidAmount?: string | number;
}

interface RiskHistoryEntry {
  id: string;
  previousScore: number;
  newScore: number;
  level: string;
  reason: string;
  occurredAt: string | Date;
}

interface LayawayHeader {
  id: string;
  type: string;
  status: string;
  totalAmount: string | number;
  financedCapital?: string | number | null;
  outstandingPrincipal?: string | number | null;
  interestRate?: string | number | null;
  termMonths?: number | null;
  installmentAmount?: string | number | null;
  createdAt?: string | Date | null;
  expiresAt?: string | Date | null;
}

interface LayawayDetails {
  layaway: LayawayHeader | null;
  items: LayawayItem[];
  payments: LayawayPayment[];
  schedule: ScheduleEntry[];
  riskHistory: RiskHistoryEntry[];
}

const STATUS_BADGE_STYLES: Record<string, string> = {
  pendiente: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  vencida:   "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  pagada:    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

const RISK_COLORS: Record<string, string> = {
  verde:    "text-green-600 dark:text-green-400",
  amarillo: "text-yellow-600 dark:text-yellow-400",
  rojo:     "text-red-600 dark:text-red-400",
};

export function LayawayDetailsDialog({
  layawayId,
  open,
  onOpenChange,
  customerName,
  layawayType = "sin_interes",
}: LayawayDetailsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [details, setDetails] = useState<LayawayDetails>({
    layaway: null,
    items: [],
    payments: [],
    schedule: [],
    riskHistory: [],
  });

  useEffect(() => {
    let active = true;
    if (open && layawayId) {
      const load = async () => {
        setLoading(true);
        try {
          const res = await getLayawayDetailsAction(layawayId);
          if (active && res.success && res.data) {
            setDetails(res.data as unknown as LayawayDetails);
          }
        } finally {
          if (active) setLoading(false);
        }
      };
      load();
    }
    return () => { active = false; };
  }, [open, layawayId]);

  const isCredit = layawayType === "credito";
  const header = details.layaway;

  const handleCopyId = async () => {
    if (!layawayId) return;
    try {
      await navigator.clipboard.writeText(layawayId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard no disponible */
    }
  };

  const formatDate = (value?: string | Date | null) =>
    value
      ? new Date(value).toLocaleDateString("es-CO", {
          day: "2-digit", month: "short", year: "numeric",
        })
      : "—";

  const initialDeposit =
    header && header.financedCapital != null
      ? Number(header.totalAmount) - Number(header.financedCapital)
      : null;

  const summary = header ? (
    <div className="rounded-md border bg-muted/30 p-3 mb-3">
      <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Resumen</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        <div className="flex justify-between col-span-2 sm:col-span-1">
          <dt className="text-muted-foreground">Precio de venta</dt>
          <dd className="font-semibold">{formatCurrency(Number(header.totalAmount))}</dd>
        </div>
        {isCredit && initialDeposit != null && (
          <div className="flex justify-between col-span-2 sm:col-span-1">
            <dt className="text-muted-foreground">Abono inicial</dt>
            <dd className="font-medium">{formatCurrency(initialDeposit)}</dd>
          </div>
        )}
        {isCredit && header.financedCapital != null && (
          <div className="flex justify-between col-span-2 sm:col-span-1">
            <dt className="text-muted-foreground">Capital financiado</dt>
            <dd className="font-medium">{formatCurrency(Number(header.financedCapital))}</dd>
          </div>
        )}
        {isCredit && header.installmentAmount != null && (
          <div className="flex justify-between col-span-2 sm:col-span-1">
            <dt className="text-muted-foreground">Cuota</dt>
            <dd className="font-medium">{formatCurrency(Number(header.installmentAmount))}</dd>
          </div>
        )}
        {isCredit && header.interestRate != null && (
          <div className="flex justify-between col-span-2 sm:col-span-1">
            <dt className="text-muted-foreground">Tasa</dt>
            <dd className="font-medium">{(Number(header.interestRate) * 100).toFixed(2)}%</dd>
          </div>
        )}
        {isCredit && header.termMonths != null && (
          <div className="flex justify-between col-span-2 sm:col-span-1">
            <dt className="text-muted-foreground">Plazo</dt>
            <dd className="font-medium">{header.termMonths} meses</dd>
          </div>
        )}
        <div className="flex justify-between col-span-2 sm:col-span-1">
          <dt className="text-muted-foreground">Creado</dt>
          <dd className="font-medium">{formatDate(header.createdAt)}</dd>
        </div>
      </dl>
    </div>
  ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-[95vw] p-4 sm:p-6 ${isCredit ? "sm:max-w-[720px]" : "sm:max-w-[500px]"}`}>
        <DialogHeader>
          <DialogTitle>
            {isCredit ? "Detalle del Crédito" : "Detalle del Apartado"}
          </DialogTitle>
          <DialogDescription>Cliente: {customerName || "Desconocido"}</DialogDescription>
          {layawayId && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-muted-foreground">ID:</span>
              <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded break-all">{layawayId}</code>
              <button
                type="button"
                onClick={handleCopyId}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                title="Copiar ID"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
          )}
        </DialogHeader>

        {loading ? (
          <div className="py-6 text-center text-muted-foreground">Cargando...</div>
        ) : isCredit ? (
          <>
          {summary}
          <Tabs defaultValue="cronograma" className="w-full min-w-0">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="cronograma">Cronograma</TabsTrigger>
              <TabsTrigger value="pagos">Pagos</TabsTrigger>
              <TabsTrigger value="riesgo">Riesgo</TabsTrigger>
            </TabsList>

            {/* Cronograma */}
            <TabsContent value="cronograma" className="max-h-[400px] overflow-y-auto">
              <div className="space-y-1 pt-2">
                {/* Artículos */}
                <div className="mb-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Artículos</p>
                  {details.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-start text-sm py-1">
                      <div>
                        <span>{item.productName}{item.serialNumber ? ` (SN: ${item.serialNumber})` : ""}</span>
                        <span className="block text-xs text-muted-foreground">
                          {formatCurrency(Number(item.agreedPrice))} c/u × {item.quantity}
                        </span>
                      </div>
                      <span className="font-medium">{formatCurrency(Number(item.agreedPrice) * item.quantity)}</span>
                    </div>
                  ))}
                </div>
                <Separator />
                {/* Tabla de amortización */}
                <div className="pt-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Tabla de amortización</p>
                  {details.schedule.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin cronograma generado.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border">
                      <table className="w-full min-w-[720px] text-xs border-collapse">
                        <thead>
                          <tr className="border-b text-muted-foreground bg-muted/40">
                            <th className="text-left py-1.5 px-2 whitespace-nowrap">#</th>
                            <th className="text-left py-1.5 px-2 whitespace-nowrap">Vencimiento</th>
                            <th className="text-right py-1.5 px-2 whitespace-nowrap">Capital</th>
                            <th className="text-right py-1.5 px-2 whitespace-nowrap">Interés</th>
                            <th className="text-right py-1.5 px-2 whitespace-nowrap">Cuota</th>
                            <th className="text-right py-1.5 px-2 whitespace-nowrap">Abonado / Falta</th>
                            <th className="text-right py-1.5 px-2 whitespace-nowrap">Saldo</th>
                            <th className="text-center py-1.5 px-2 whitespace-nowrap">Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {details.schedule.map((entry) => {
                            const paidAmount = Number(entry.paidAmount ?? 0);
                            const isPartial = entry.status !== "pagada" && paidAmount > 0;
                            return (
                              <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/30">
                                <td className="py-1.5 px-2 font-medium">{entry.number}</td>
                                <td className="py-1.5 px-2 text-muted-foreground whitespace-nowrap">
                                  {new Date(entry.dueDate).toLocaleDateString("es-CO", {
                                    day: "2-digit", month: "short", year: "numeric",
                                  })}
                                </td>
                                <td className="py-1.5 px-2 text-right whitespace-nowrap">{formatCurrency(Number(entry.principal))}</td>
                                <td className="py-1.5 px-2 text-right text-muted-foreground whitespace-nowrap">{formatCurrency(Number(entry.interest))}</td>
                                <td className="py-1.5 px-2 text-right font-medium whitespace-nowrap">{formatCurrency(Number(entry.totalAmount))}</td>
                                <td className="py-1.5 px-2 text-right whitespace-nowrap">
                                  {isPartial ? (
                                    <span className="text-amber-600 dark:text-amber-400">
                                      {formatCurrency(paidAmount)} / falta {formatCurrency(Number(entry.totalAmount) - paidAmount)}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                                <td className="py-1.5 px-2 text-right whitespace-nowrap">{formatCurrency(Number(entry.remainingBalance))}</td>
                                <td className="py-1.5 px-2 text-center">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                      isPartial
                                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                        : STATUS_BADGE_STYLES[entry.status] ?? ""
                                    }`}
                                  >
                                    {isPartial ? "parcial" : entry.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Pagos */}
            <TabsContent value="pagos" className="max-h-[400px] overflow-y-auto">
              <div className="pt-2 space-y-2">
                {details.payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin pagos registrados.</p>
                ) : (
                  details.payments.map((payment) => (
                    <div key={payment.id} className="flex justify-between items-center text-sm bg-muted/30 p-2 rounded">
                      <div>
                        <span>{new Date(payment.createdAt).toLocaleDateString("es-CO")}</span>
                        <span className="text-xs text-muted-foreground ml-2 capitalize">{payment.method}</span>
                        {payment.notes && <span className="text-xs text-muted-foreground ml-2">— {payment.notes}</span>}
                      </div>
                      <Badge variant="secondary" className="font-mono">
                        +{formatCurrency(Number(payment.amount))}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            {/* Riesgo */}
            <TabsContent value="riesgo" className="max-h-[400px] overflow-y-auto">
              <div className="pt-2 space-y-2">
                {details.riskHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin cambios de riesgo registrados.</p>
                ) : (
                  details.riskHistory.map((entry) => (
                    <div key={entry.id} className="text-sm bg-muted/30 p-2 rounded space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">
                          {new Date(entry.occurredAt).toLocaleDateString("es-CO", {
                            day: "2-digit", month: "short", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </span>
                        <span className={`font-semibold text-sm ${RISK_COLORS[entry.level] ?? ""}`}>
                          {entry.previousScore} → {entry.newScore} ({entry.level})
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{entry.reason}</p>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
          </>
        ) : (
          /* Vista sin_interes (original) */
          <div className="space-y-6">
            {summary}
            <div>
              <h4 className="font-semibold text-sm mb-3">Artículos Apartados</h4>
              <div className="space-y-3">
                {details.items.map((item) => (
                  <div key={item.id} className="flex justify-between items-start text-sm border-b pb-2 last:border-0">
                    <div>
                      <p className="font-medium">{item.productName}</p>
                      <div className="text-xs text-muted-foreground flex gap-2 mt-1">
                        <span>{formatCurrency(Number(item.agreedPrice))} c/u</span>
                        <span>Cant: {item.quantity}</span>
                        {item.serialNumber && <span>SN: {item.serialNumber}</span>}
                      </div>
                    </div>
                    <div className="font-medium">{formatCurrency(Number(item.agreedPrice) * item.quantity)}</div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold text-sm mb-3">Historial de Pagos</h4>
              {details.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin abonos registrados.</p>
              ) : (
                <div className="space-y-2">
                  {details.payments.map((payment) => (
                    <div key={payment.id} className="flex justify-between items-center text-sm bg-muted/30 p-2 rounded">
                      <div className="flex flex-col">
                        <span>{new Date(payment.createdAt).toLocaleDateString("es-ES")}</span>
                        <span className="text-xs text-muted-foreground capitalize">
                          {payment.method} - {payment.notes}
                        </span>
                      </div>
                      <Badge variant="secondary" className="font-mono">
                        +{formatCurrency(Number(payment.amount))}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
