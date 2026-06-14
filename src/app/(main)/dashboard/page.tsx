import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Package, ShoppingCart, Users } from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";
import { getDashboardKPIs, getRecentSales } from "@/services/dashboard-service";

export default async function DashboardPage() {
  const kpis = await getDashboardKPIs();
  const recentSales = await getRecentSales(5);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(amount);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-[1480px] mx-auto">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={DollarSign}
          title="Ventas Totales"
          value={formatCurrency(kpis.sales.total)}
          trend={{ value: kpis.sales.growth }}
        />
        <KpiCard
          icon={Users}
          title="Reservas Activas"
          value={kpis.reservations.active}
          description="Reservas en curso"
        />
        <KpiCard
          icon={Package}
          title="Total Productos"
          value={kpis.products.total}
          description="Productos en el catálogo"
        />
        <KpiCard
          icon={ShoppingCart}
          title="Por Retirar"
          value={kpis.pickups.pending}
          description="Equipos de inventario en reserva"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Resumen Reciente</CardTitle>
            <CardDescription>Resumen de operaciones del día.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              Gráfico de Ventas (Placeholder)
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Ventas Recientes</CardTitle>
            <CardDescription>
              Hubo {recentSales.length} ventas recientemente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center">
                  <div className="ml-4 space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {sale.customerName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {sale.customerEmail}
                    </p>
                  </div>
                  <div className="ml-auto font-medium">
                    +{formatCurrency(sale.totalAmount)}
                  </div>
                </div>
              ))}

              {recentSales.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-4">
                  No hay ventas registradas.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
