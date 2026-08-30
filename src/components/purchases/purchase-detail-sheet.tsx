"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { getPurchaseByIdAction } from "@/app/actions/purchase-actions";
import { formatCurrency } from "@/lib/formatters";
import { PurchaseStatusBadge } from "./purchase-status-badge";
import { PurchasePaymentDialog } from "./purchase-payment-dialog";
import { describeAttributes } from "./product-picker";

type PurchaseDetail = NonNullable<
  Awaited<ReturnType<typeof getPurchaseByIdAction>>["data"]
>;

interface PurchaseDetailSheetProps {
  purchaseId: string | null;
  onOpenChange: (open: boolean) => void;
  cashAccounts: { id: string; name: string; balance?: string | number }[];
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  transfer: "Transferencia",
  cash: "Efectivo",
  card: "Tarjeta",
  wallet: "Billetera",
};

export function PurchaseDetailSheet({
  purchaseId,
  onOpenChange,
  cashAccounts,
}: PurchaseDetailSheetProps) {
  const router = useRouter();
  const [purchase, setPurchase] = useState<PurchaseDetail | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);

  useEffect(() => {
    if (!purchaseId) return;

    let cancelled = false;

    getPurchaseByIdAction(purchaseId).then((res) => {
      if (cancelled) return;
      if (res.success && res.data) {
        setPurchase(res.data);
      } else {
        setFailedId(purchaseId);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [purchaseId]);

  // El detalle mostrado sólo vale si corresponde a la fila abierta; mientras
  // llega el de la nueva fila se muestra el esqueleto, sin limpiar estado.
  const current = purchase && purchase.id === purchaseId ? purchase : null;
  const failed = failedId !== null && failedId === purchaseId;
  const loading = Boolean(purchaseId) && !current && !failed;

  const reload = () => {
    router.refresh();
    if (purchaseId) {
      getPurchaseByIdAction(purchaseId).then((res) => {
        if (res.success && res.data) setPurchase(res.data);
      });
    }
  };

  return (
    <Sheet open={Boolean(purchaseId)} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col overflow-y-auto w-full sm:max-w-2xl p-0 bg-card border-l border-border">
        <SheetHeader className="px-6 pt-[22px] pb-[18px] border-b border-border">
          <SheetTitle className="text-[18px] font-bold tracking-[-0.02em]">
            Detalle de compra
          </SheetTitle>
          <SheetDescription className="text-[13px] text-[color:var(--tf-fg-muted)]">
            {current
              ? `${current.provider?.name ?? "Proveedor desconocido"} · ${new Date(
                  current.purchaseDate,
                ).toLocaleDateString("es-CO")}`
              : "Cargando información de la compra..."}
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 py-5 space-y-6">
          {loading && (
            <div className="space-y-3">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}

          {!loading && !current && (
            <p className="text-sm text-muted-foreground">
              No se pudo cargar la compra.
            </p>
          )}

          {!loading && current && (
            <>
              <div className="grid grid-cols-2 gap-4 text-[13px]">
                <div>
                  <p className="text-muted-foreground">Factura</p>
                  <p className="font-medium">
                    {current.invoiceNumber || current.referenceCode || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Estado de pago</p>
                  <PurchaseStatusBadge status={current.paymentStatus} />
                </div>
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-mono font-semibold">
                    {formatCurrency(Number(current.totalAmount))}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Saldo pendiente</p>
                  <p className="font-mono font-semibold">
                    {formatCurrency(current.pendingAmount)}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-[14px] font-semibold">Productos</h3>
                {current.details.map((detail) => (
                  <div
                    key={detail.id}
                    className="border border-border rounded-lg p-3 space-y-1"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium truncate">
                          {detail.product?.name ?? "Producto eliminado"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[
                            describeAttributes(detail.product?.attributes),
                            detail.serialNumber
                              ? `IMEI: ${detail.serialNumber}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <p className="font-mono text-[13px] shrink-0">
                        {formatCurrency(Number(detail.lineTotal))}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {detail.quantity} × {formatCurrency(Number(detail.unitCost))}
                      {detail.landedUnitCost &&
                        Number(detail.landedUnitCost) !==
                          Number(detail.unitCost) && (
                          <>
                            {" · "}
                            <span className="text-foreground">
                              costo aterrizado{" "}
                              {formatCurrency(Number(detail.landedUnitCost))}
                            </span>
                          </>
                        )}
                    </p>
                  </div>
                ))}
              </div>

              {current.extraCosts.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h3 className="text-[14px] font-semibold">
                      Costos adicionales
                    </h3>
                    {current.extraCosts.map((cost) => (
                      <div
                        key={cost.id}
                        className="flex justify-between text-[13px]"
                      >
                        <span className="capitalize">{cost.concept}</span>
                        <span className="font-mono">
                          {formatCurrency(Number(cost.amount))}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[14px] font-semibold">Abonos</h3>
                  {current.pendingAmount > 0 && (
                    <PurchasePaymentDialog
                      purchaseId={current.id}
                      pendingAmount={current.pendingAmount}
                      cashAccounts={cashAccounts}
                      onPaid={reload}
                    />
                  )}
                </div>

                {current.payments.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">
                    Sin abonos registrados: la compra quedó a crédito.
                  </p>
                ) : (
                  current.payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between text-[13px] border-b border-border pb-2 last:border-0"
                    >
                      <div>
                        <p>
                          {new Date(payment.occurredAt).toLocaleDateString(
                            "es-CO",
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {payment.accountName ?? "Cuenta eliminada"} ·{" "}
                          {PAYMENT_METHOD_LABELS[payment.paymentMethod] ??
                            payment.paymentMethod}
                        </p>
                      </div>
                      <span className="font-mono">
                        {formatCurrency(Number(payment.amount))}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {current.notes && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-[14px] font-semibold mb-1">Notas</h3>
                    <p className="text-[13px] text-muted-foreground">
                      {current.notes}
                    </p>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
