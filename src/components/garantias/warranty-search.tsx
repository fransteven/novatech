"use client";

import { useState, useTransition } from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { lookupWarrantyAction } from "@/app/actions/warranty-actions";
import { WarrantyResultCard } from "@/components/garantias/warranty-result-card";

export type WarrantyLookupResult = Awaited<
  ReturnType<typeof lookupWarrantyAction>
>["data"];

export function WarrantySearch() {
  const [serial, setSerial] = useState("");
  const [result, setResult] = useState<WarrantyLookupResult | null>(null);
  const [searched, setSearched] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSearch = () => {
    if (!serial.trim()) return;
    startTransition(async () => {
      const res = await lookupWarrantyAction({ serial });
      setSearched(true);
      setResult(res.success ? res.data ?? null : null);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Escanea o ingresa el serial / IMEI del equipo"
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-9"
          />
        </div>
        <Button onClick={handleSearch} disabled={isPending || !serial.trim()}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Consultar"
          )}
        </Button>
      </div>

      {searched && !isPending && (
        <WarrantyResultCard result={result} searchedSerial={serial.trim()} />
      )}
    </div>
  );
}
