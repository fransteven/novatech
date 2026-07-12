"use client";

import { useState } from "react";
import { ShieldCheck, ShieldX, ShieldAlert, ShieldQuestion } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClaimDialog } from "@/components/garantias/claim-dialog";
import type { WarrantyLookupResult } from "@/components/garantias/warranty-search";

function formatDate(date: Date | string | null) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function WarrantyResultCard({
  result,
  searchedSerial,
}: {
  result: WarrantyLookupResult | null;
  searchedSerial: string;
}) {
  const [claimOpen, setClaimOpen] = useState(false);

  if (!result || !result.found) {
    return (
      <Card className="border-[color:var(--tf-amber,orange)]/40">
        <CardContent className="flex items-start gap-3 pt-0">
          <ShieldQuestion className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-[14.5px]">
              &quot;{searchedSerial}&quot; no está registrado en NovaTech
            </p>
            <p className="text-[13px] text-muted-foreground mt-1">
              Este serial/IMEI no coincide con ninguna unidad vendida por
              nosotros. Verifica que el equipo presentado sea el mismo que se
              vendió — posible sustitución.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!result.delivered) {
    return (
      <Card>
        <CardContent className="flex items-start gap-3 pt-0">
          <ShieldAlert className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-[14.5px]">
              {result.product?.name} — sin entrega registrada
            </p>
            <p className="text-[13px] text-muted-foreground mt-1">
              La unidad existe en inventario pero no hay venta ni apartado
              asociado, por lo que la garantía aún no ha iniciado.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isVigente = result.status === "vigente";

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-[16px]">
            {isVigente ? (
              <ShieldCheck className="h-5 w-5 text-[color:var(--tf-green)]" />
            ) : (
              <ShieldX className="h-5 w-5 text-[color:var(--tf-red)]" />
            )}
            {result.product?.name}
          </CardTitle>
          <p className="text-[12.5px] text-muted-foreground font-mono mt-1">
            {result.productItem?.serialNumber}
          </p>
        </div>
        <Badge variant={isVigente ? "default" : "destructive"}>
          {isVigente ? "VIGENTE" : "VENCIDA"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <div>
            <p className="text-muted-foreground">Cliente</p>
            <p className="font-medium">{result.customer?.name || "Sin registrar"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Origen</p>
            <p className="font-medium">
              {result.sourceType === "sale" ? "Venta directa" : "Apartado / Crédito"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Fecha de entrega</p>
            <p className="font-medium">{formatDate(result.startDate)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Vence</p>
            <p className="font-medium">
              {formatDate(result.expiryDate)} ({result.warrantyMonths} meses)
            </p>
          </div>
        </div>

        {isVigente && result.daysRemaining !== null && (
          <p className="text-[12.5px] text-muted-foreground">
            {result.daysRemaining} día(s) restantes de cobertura.
          </p>
        )}

        {result.isProvisional && (
          <p className="text-[12px] text-amber-600 dark:text-amber-400">
            Garantía calculada a partir de la fecha de venta/apartado. Si el
            equipo se entregó en otra fecha, ajústala al registrar el reclamo.
          </p>
        )}

        {result.claims && result.claims.length > 0 && (
          <div className="pt-2 border-t border-border">
            <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Reclamos previos
            </p>
            <ul className="space-y-1.5">
              {result.claims.map((c) => (
                <li key={c.id} className="text-[13px] flex items-center justify-between gap-2">
                  <span className="truncate">{c.issue}</span>
                  <Badge variant="outline">{c.status}</Badge>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Button
          size="sm"
          variant={isVigente ? "default" : "outline"}
          onClick={() => setClaimOpen(true)}
        >
          Registrar reclamo
        </Button>
      </CardContent>

      <ClaimDialog
        open={claimOpen}
        onOpenChange={setClaimOpen}
        productItemId={result.productItem?.id ?? ""}
        defaultSerial={result.productItem?.serialNumber ?? ""}
        withinWarranty={isVigente}
      />
    </Card>
  );
}
