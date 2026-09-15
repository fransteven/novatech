import { CircleAlert, DollarSign, Package, ShoppingCart, Users } from "lucide-react";

import { getDashboardOverviewAction } from "@/app/actions/dashboard-actions";
import { SalesTrend } from "@/components/dashboard/sales-trend";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { formatCurrency } from "@/lib/formatters";

export const dynamic = "force-dynamic";

const operationDateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function DashboardPage() {
  const overview = await getDashboardOverviewAction();

  if (!overview.success) {
    return (
      <PageShell>
        <PageHeader title="Dashboard" description="Resumen de la operación diaria." eyebrow="CONTROL OPERATIVO" />
        <EmptyState icon={CircleAlert} headline="El resumen no está disponible" description={overview.error} />
      </PageShell>
    );
  }

  const { kpis, recentSales, trend } = overview.data;

  return (
    <PageShell className="space-y-5">
      <PageHeader title="Dashboard" description="Ventas, inventario reservado y actividad reciente en un solo registro." eyebrow="CONTROL OPERATIVO" />

      <section aria-label="Indicadores operativos" className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={DollarSign} title="Ventas del mes" value={formatCurrency(kpis.sales.total)} trend={{ value: kpis.sales.growth }} emphasis="primary" />
        <KpiCard icon={Users} title="Reservas activas" value={kpis.reservations.active} description="Registros en curso" />
        <KpiCard icon={Package} title="Productos" value={kpis.products.total} description="Referencias en catálogo" />
        <KpiCard icon={ShoppingCart} title="Por retirar" value={kpis.pickups.pending} description="Unidades aún reservadas" />
      </section>

      <section className="grid gap-3 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-base tracking-[-0.02em]">Ritmo de ventas</CardTitle>
            <CardDescription>Facturación completada en los últimos treinta días.</CardDescription>
          </CardHeader>
          <CardContent className="pt-1"><SalesTrend points={trend} /></CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-base tracking-[-0.02em]">Últimas operaciones</CardTitle>
            <CardDescription>{recentSales.length} registro{recentSales.length === 1 ? "" : "s"} reciente{recentSales.length === 1 ? "" : "s"}.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border pt-1">
            {recentSales.length ? recentSales.map((sale) => (
              <article className="flex items-center gap-3 py-3" key={sale.id}>
                <span aria-hidden="true" className="mt-0.5 size-2 shrink-0 rounded-full bg-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{sale.customerName}</p>
                  <p className="truncate text-xs text-muted-foreground">{sale.customerEmail}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="mono text-sm font-semibold">{formatCurrency(sale.totalAmount)}</p>
                  <p className="mono text-[10px] text-muted-foreground">{operationDateFormatter.format(sale.createdAt)}</p>
                </div>
              </article>
            )) : <EmptyState headline="Sin ventas recientes" description="Las operaciones completadas aparecerán aquí." className="my-3 border-0 bg-transparent py-8" />}
          </CardContent>
        </Card>
      </section>
    </PageShell>
  );
}
