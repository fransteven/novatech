import { KpiCard } from "@/components/ui/kpi-card";
import { DollarSign, TrendingUp, Clock } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface ImportCostsKpisProps {
  stats: {
    totalRecords: number;
    totalInvestedCOP: number;
    avgProductTrm: number;
    avgCasilleroTrm: number;
    pendingQuotes: number;
  };
}

export function ImportCostsKpis({ stats }: ImportCostsKpisProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        icon={DollarSign}
        title="Total Invertido"
        value={formatCurrency(stats.totalInvestedCOP)}
        description={`En ${stats.totalRecords} compras realizadas`}
      />
      <KpiCard
        icon={TrendingUp}
        title="TRM Promedio Producto"
        value={stats.avgProductTrm > 0 ? formatCurrency(stats.avgProductTrm) : "—"}
        description="Dólar promedio al comprar equipos"
      />
      <KpiCard
        icon={TrendingUp}
        title="TRM Promedio Casillero"
        value={
          stats.avgCasilleroTrm > 0 ? formatCurrency(stats.avgCasilleroTrm) : "—"
        }
        description="Dólar promedio al pagar casillero"
      />
      <KpiCard
        icon={Clock}
        title="Cotizaciones Pendientes"
        value={stats.pendingQuotes}
        description="Registros sin confirmar como compra"
        valueClassName={stats.pendingQuotes > 0 ? "text-amber-500" : undefined}
      />
    </div>
  );
}
