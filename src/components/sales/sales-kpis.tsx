import { KpiCard } from "@/components/ui/kpi-card";
import { DollarSign, Package, TrendingDown, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface SalesKPIsProps {
  kpis: {
    monthlyRevenue: number;
    monthlyInventoryValueSold: number;
    monthlyExpenses: number;
  };
}

export function SalesKPIs({ kpis }: SalesKPIsProps) {
  const { monthlyRevenue, monthlyInventoryValueSold, monthlyExpenses } = kpis;
  const operatingIncome = monthlyRevenue - monthlyExpenses;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        icon={DollarSign}
        title="Ingresos Totales (Mes)"
        value={formatCurrency(monthlyRevenue)}
        description="Ventas registradas este mes"
      />
      <KpiCard
        icon={Package}
        title="Valor Inventario Movido"
        value={formatCurrency(monthlyInventoryValueSold)}
        description="Costo de mercancía vendida (aprox.)"
      />
      <KpiCard
        icon={TrendingDown}
        title="Gastos Operativos"
        value={formatCurrency(monthlyExpenses)}
        description="Salidas de dinero registradas"
      />
      <KpiCard
        icon={TrendingUp}
        title="Flujo de Caja Operativo"
        value={formatCurrency(operatingIncome)}
        valueClassName={operatingIncome >= 0 ? "text-green-600" : "text-red-600"}
        description="Ingresos - Gastos (Sin incluir costo venta)"
      />
    </div>
  );
}
