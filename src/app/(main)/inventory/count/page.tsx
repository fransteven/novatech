import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight, ScanLine } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { NewCountButton } from "@/components/stock-count/new-count-button";
import { listCounts } from "@/services/stock-count-service";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Toma de inventario" };

const STATUS_LABEL: Record<string, string> = {
  draft: "En curso",
  applied: "Aplicado",
  cancelled: "Cancelado",
};

export default async function StockCountsPage() {
  const counts = await listCounts();

  return (
    <PageShell width="standard" className="space-y-6">
      <PageHeader
        eyebrow="INVENTARIO"
        title="Toma de inventario"
        description="Escanea la mercancía por zonas. Lo que no está en el catálogo se crea al vuelo; al aplicar el conteo entra al stock con su costo."
        actions={<NewCountButton />}
      />

      {counts.length === 0 ? (
        <EmptyState
          icon={ScanLine}
          headline="Todavía no hay conteos"
          description="Crea uno por estante o vitrina y empieza a escanear."
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-[10px] border border-border bg-card">
          {counts.map((count) => (
            <li key={count.id}>
              <Link
                href={`/inventory/count/${count.id}`}
                className="flex items-center gap-3 p-4 transition-colors duration-150 hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{count.name}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="mono">{count.lines}</span> productos ·{" "}
                    <span className="mono">{count.units}</span> unidades ·{" "}
                    <span className="mono">{formatCurrency(count.value)}</span>
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                    count.status === "draft"
                      ? "tf-badge-low"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {STATUS_LABEL[count.status] ?? count.status}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
