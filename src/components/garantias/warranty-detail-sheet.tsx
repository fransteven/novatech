"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { WarrantyResultCard } from "@/components/garantias/warranty-result-card";
import { getWarrantyDetailAction } from "@/app/actions/warranty-actions";
import type { WarrantyAnchor } from "@/lib/validators/warranty-validator";
import type { WarrantyDetail } from "@/services/warranty-service";

type LoadedDetail = {
  /** Ancla a la que pertenece este detalle, para no pintar datos de otra fila. */
  anchorKey: string;
  detail: WarrantyDetail | null;
  error: string | null;
};

interface WarrantyDetailSheetProps {
  anchor: WarrantyAnchor | null;
  onOpenChange: (open: boolean) => void;
  canAdjust: boolean;
  /** Se llama tras registrar un reclamo o ajustar la entrega. */
  onChanged: () => void;
}

export function WarrantyDetailSheet({
  anchor,
  onOpenChange,
  canAdjust,
  onChanged,
}: WarrantyDetailSheetProps) {
  const [loaded, setLoaded] = useState<LoadedDetail | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [, startTransition] = useTransition();

  const anchorKey = useMemo(
    () => (anchor ? JSON.stringify(anchor) : null),
    [anchor],
  );

  useEffect(() => {
    if (!anchorKey || !anchor) return;
    startTransition(async () => {
      const res = await getWarrantyDetailAction(anchor);
      setLoaded({
        anchorKey,
        detail: res.success ? res.data : null,
        error: res.success ? null : res.error,
      });
    });
    // `anchor` se recarga a través de `anchorKey`, que es su forma estable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorKey, reloadKey]);

  // Un detalle de otra fila es basura: mientras no llegue el de la fila actual
  // se muestra el spinner en vez de datos equivocados.
  const current = loaded?.anchorKey === anchorKey ? loaded : null;

  // Tras un reclamo o un ajuste, el detalle abierto queda obsoleto: se recarga
  // aquí y se avisa al listado para que también se refresque.
  const handleChanged = () => {
    setReloadKey((k) => k + 1);
    onChanged();
  };

  return (
    <Sheet open={anchor !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Detalle de garantía</SheetTitle>
          <SheetDescription>
            Estado de cobertura, historial de reclamos y acciones sobre esta
            entrega.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6">
          {!current && (
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground py-8">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando…
            </div>
          )}
          {current?.error && (
            <p className="text-[13px] text-destructive py-8">{current.error}</p>
          )}
          {current?.detail && (
            <WarrantyResultCard
              detail={current.detail}
              canAdjust={canAdjust}
              onChanged={handleChanged}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
