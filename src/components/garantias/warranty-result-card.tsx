"use client";

import { useState } from "react";
import { ShieldCheck, ShieldX, ShieldOff, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ClaimDialog } from "@/components/garantias/claim-dialog";
import { AdjustWarrantyDialog } from "@/components/garantias/adjust-warranty-dialog";
import { WarrantyStatusBadge } from "@/components/garantias/warranty-status-badge";
import { formatWarrantyDate, formatDocumentNumber } from "@/lib/warranty/format";
import type { WarrantyDetail } from "@/services/warranty-service";

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <p className="text-muted-foreground text-[12px]">{label}</p>
    <p className="font-medium text-[13.5px]">{value}</p>
  </div>
);

interface WarrantyResultCardProps {
  detail: WarrantyDetail;
  /** El ajuste de fecha de entrega es una corrección administrativa. */
  canAdjust: boolean;
  onChanged: () => void;
}

export function WarrantyResultCard({
  detail,
  canAdjust,
  onChanged,
}: WarrantyResultCardProps) {
  const [claimOpen, setClaimOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const isVigente = detail.status === "vigente";
  const StatusIcon =
    detail.status === "vigente"
      ? ShieldCheck
      : detail.status === "vencida"
        ? ShieldX
        : ShieldOff;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2.5">
          <StatusIcon
            className={
              isVigente
                ? "h-5 w-5 mt-0.5 text-emerald-500"
                : "h-5 w-5 mt-0.5 text-destructive"
            }
          />
          <div>
            <p className="font-semibold text-[15px]">{detail.productName}</p>
            <p className="text-[12.5px] text-muted-foreground font-mono mt-0.5">
              {detail.serialNumber ?? detail.sku ?? "Sin serial"}
            </p>
          </div>
        </div>
        <WarrantyStatusBadge status={detail.status} />
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Field
          label="Cliente"
          value={detail.customerName ?? "Sin registrar"}
        />
        <Field
          label="Contacto"
          value={detail.customerPhone ?? detail.customerDocument ?? "—"}
        />
        <Field
          label="Origen"
          value={`${detail.sourceType === "sale" ? "Venta directa" : "Apartado / Crédito"} ${formatDocumentNumber(detail.sourceId)}`}
        />
        <Field
          label="Cobertura"
          value={`${detail.warrantyMonths} ${detail.warrantyMonths === 1 ? "mes" : "meses"}`}
        />
        <Field
          label="Fecha de entrega"
          value={formatWarrantyDate(detail.startDate)}
        />
        <Field label="Vence" value={formatWarrantyDate(detail.expiryDate)} />
      </div>

      {isVigente && (
        <p className="text-[12.5px] text-muted-foreground">
          {detail.daysRemaining} día(s) restantes de cobertura.
        </p>
      )}

      {detail.status === "sin_cobertura" && (
        <p className="text-[12.5px] text-muted-foreground">
          Esta garantía fue anulada administrativamente, sin importar las fechas.
        </p>
      )}

      {detail.isProvisional && (
        <p className="text-[12px] text-amber-600 dark:text-amber-400">
          Garantía calculada desde la fecha de la venta/apartado. Si el equipo se
          entregó en otra fecha, corrígela con &quot;Ajustar entrega&quot;.
        </p>
      )}

      {detail.notes && (
        <p className="text-[12.5px] text-muted-foreground italic">
          {detail.notes}
        </p>
      )}

      {detail.claims.length > 0 && (
        <div className="pt-1 border-t border-border">
          <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide my-2">
            Reclamos previos
          </p>
          <ul className="space-y-1.5">
            {detail.claims.map((claim) => (
              <li
                key={claim.id}
                className="text-[13px] flex items-center justify-between gap-2"
              >
                <span className="truncate">{claim.issue}</span>
                <Badge variant="outline" className="shrink-0">
                  {claim.status}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          variant={isVigente ? "default" : "outline"}
          onClick={() => setClaimOpen(true)}
        >
          Registrar reclamo
        </Button>
        {canAdjust && (
          <Button size="sm" variant="ghost" onClick={() => setAdjustOpen(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Ajustar entrega
          </Button>
        )}
      </div>

      <ClaimDialog
        open={claimOpen}
        onOpenChange={setClaimOpen}
        anchor={detail.anchor}
        defaultSerial={detail.serialNumber ?? ""}
        withinWarranty={isVigente}
        onRegistered={onChanged}
      />

      <AdjustWarrantyDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        anchor={detail.anchor}
        startDate={detail.startDate}
        warrantyMonths={detail.warrantyMonths}
        onAdjusted={onChanged}
      />
    </div>
  );
}
