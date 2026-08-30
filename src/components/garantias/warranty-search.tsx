"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, ShieldQuestion, ShieldAlert, PackageSearch } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { WarrantyResultsTable } from "@/components/garantias/warranty-results-table";
import { WarrantyDetailSheet } from "@/components/garantias/warranty-detail-sheet";
import { searchWarrantiesAction } from "@/app/actions/warranty-actions";
import type { WarrantyAnchor } from "@/lib/validators/warranty-validator";
import type { WarrantySearchResult } from "@/services/warranty-service";

const SEARCH_DEBOUNCE_MS = 350;

interface WarrantySearchProps {
  /** Solo un admin puede corregir la fecha de entrega registrada. */
  canAdjust: boolean;
}

export function WarrantySearch({ canAdjust }: WarrantySearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("todas");
  const [sourceType, setSourceType] = useState("todas");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [result, setResult] = useState<WarrantySearchResult | null>(null);
  const [selected, setSelected] = useState<WarrantyAnchor | null>(null);
  const [isPending, startTransition] = useTransition();

  // Evita que una respuesta lenta pise el resultado de una búsqueda posterior.
  const requestId = useRef(0);

  const runSearch = useCallback(() => {
    const id = ++requestId.current;
    startTransition(async () => {
      const res = await searchWarrantiesAction({
        q: query,
        status,
        sourceType,
        from: from || undefined,
        to: to || undefined,
      });
      if (id !== requestId.current) return;
      setResult(res.success ? res.data : { rows: [], serialInInventoryWithoutDelivery: false, serialUnknown: false });
    });
  }, [query, status, sourceType, from, to]);

  useEffect(() => {
    const timer = setTimeout(runSearch, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [runSearch]);

  // Un reclamo o un ajuste cambian tanto la fila como la tabla de reclamos del
  // servidor, así que se refrescan los dos.
  const handleChanged = () => {
    runSearch();
    router.refresh();
  };

  const rows = result?.rows ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="warranty-q">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="warranty-q"
              placeholder="IMEI, cliente, cédula, teléfono, producto o N° de venta"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              autoComplete="off"
            />
            {isPending && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="warranty-status">Estado</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="warranty-status" className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="vigente">Vigentes</SelectItem>
              <SelectItem value="vencida">Vencidas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="warranty-source">Origen</Label>
          <Select value={sourceType} onValueChange={setSourceType}>
            <SelectTrigger id="warranty-source" className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos</SelectItem>
              <SelectItem value="sale">Venta directa</SelectItem>
              <SelectItem value="layaway">Apartado / Crédito</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="warranty-from">Entrega desde</Label>
          <Input
            id="warranty-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-[150px]"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="warranty-to">Hasta</Label>
          <Input
            id="warranty-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-[150px]"
          />
        </div>
      </div>

      {rows.length > 0 ? (
        <>
          <p className="text-[12.5px] text-muted-foreground">
            {rows.length} entrega(s). Haz clic en una fila para ver el detalle y
            registrar un reclamo.
          </p>
          <WarrantyResultsTable
            rows={rows}
            onSelect={(row) => setSelected(row.anchor)}
          />
        </>
      ) : (
        result !== null &&
        !isPending && (
          <>
            {result.serialUnknown ? (
              <EmptyState
                icon={ShieldQuestion}
                headline={`"${query.trim()}" no está registrado en NovaTech`}
                description="Ningún equipo vendido por nosotros tiene ese serial/IMEI. Verifica que el equipo presentado sea el mismo que se vendió — posible sustitución."
              />
            ) : result.serialInInventoryWithoutDelivery ? (
              <EmptyState
                icon={ShieldAlert}
                headline="El equipo está en inventario, pero sin entrega registrada"
                description="No hay venta ni apartado asociado, así que la garantía todavía no ha iniciado."
              />
            ) : (
              <EmptyState
                icon={PackageSearch}
                headline="Sin resultados"
                description="Ajusta la búsqueda o los filtros de estado, origen y fechas."
              />
            )}
          </>
        )
      )}

      <WarrantyDetailSheet
        anchor={selected}
        onOpenChange={(open) => !open && setSelected(null)}
        canAdjust={canAdjust}
        onChanged={handleChanged}
      />
    </div>
  );
}
