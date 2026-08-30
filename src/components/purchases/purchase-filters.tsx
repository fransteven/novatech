"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { useDebounce } from "@/hooks/use-debounce";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const ALL = "__all__";

interface PurchaseFiltersProps {
  providers: { id: string; name: string }[];
}

/** Filtros de compras: viven en la URL para que la página sea compartible. */
export function PurchaseFilters({ providers }: PurchaseFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const debouncedSearch = useDebounce(search, 400);

  const setParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== ALL) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  useEffect(() => {
    const current = searchParams.get("search") ?? "";
    if (current === debouncedSearch) return;
    setParam("search", debouncedSearch || null);
    // setParam depende de searchParams; el efecto sólo debe correr al cambiar la búsqueda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const hasFilters =
    searchParams.get("search") ||
    searchParams.get("providerId") ||
    searchParams.get("paymentStatus") ||
    searchParams.get("from") ||
    searchParams.get("to");

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <div className="relative flex-1 min-w-[220px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-[15px] w-[15px] text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por factura, referencia o proveedor..."
          className="pl-9"
        />
      </div>

      <Select
        value={searchParams.get("providerId") ?? ALL}
        onValueChange={(value) => setParam("providerId", value)}
      >
        <SelectTrigger className="w-[190px]">
          <SelectValue placeholder="Proveedor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos los proveedores</SelectItem>
          {providers.map((provider) => (
            <SelectItem key={provider.id} value={provider.id}>
              {provider.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("paymentStatus") ?? ALL}
        onValueChange={(value) => setParam("paymentStatus", value)}
      >
        <SelectTrigger className="w-[170px]">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos los estados</SelectItem>
          <SelectItem value="paid">Pagadas</SelectItem>
          <SelectItem value="partial">Abono parcial</SelectItem>
          <SelectItem value="pending">A crédito</SelectItem>
        </SelectContent>
      </Select>

      <Input
        type="date"
        className="w-[150px]"
        value={searchParams.get("from") ?? ""}
        onChange={(event) => setParam("from", event.target.value || null)}
      />
      <Input
        type="date"
        className="w-[150px]"
        value={searchParams.get("to") ?? ""}
        onChange={(event) => setParam("to", event.target.value || null)}
      />

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSearch("");
            startTransition(() => router.replace(pathname, { scroll: false }));
          }}
        >
          <X className="h-4 w-4 mr-1" />
          Limpiar
        </Button>
      )}

      {isPending && (
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      )}
    </div>
  );
}
