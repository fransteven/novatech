import { getLeadsAction } from "@/app/actions/lead-actions";
import { LeadsTable } from "@/components/leads/leads-table";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { KpiCard } from "@/components/ui/kpi-card";
import { Target, TrendingUp, DollarSign, Trophy } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const response = await getLeadsAction();

  if (!response.success) {
    return (
      <PageShell width="standard" className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {response.error || "No se pudieron cargar los leads."}
          </AlertDescription>
        </Alert>
      </PageShell>
    );
  }

  const leads = response.data ?? [];

  const active = leads.filter((l) =>
    ["nuevo", "contactado", "negociando"].includes(l.stage)
  );

  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);

  const wonThisMonth = leads.filter(
    (l) =>
      l.stage === "ganado" && new Date(l.updatedAt) >= thisMonth
  ).length;

  const totalPipeline = active.reduce((s, l) => s + l.salePrice, 0);
  const totalMargin = active.reduce((s, l) => s + l.margin, 0);

  return (
    <PageShell width="standard" className="space-y-6">
      <PageHeader
        title="Leads"
        description="Pipeline de ventas a crédito. Registra prospectos, genera estrategias con IA y conviértelos en créditos."
        icon={Target}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Target}
          title="Leads activos"
          value={active.length}
          description="Nuevo, contactado o negociando"
        />
        <KpiCard
          icon={DollarSign}
          title="Valor pipeline"
          value={formatCurrency(totalPipeline)}
          valueClassName="text-primary"
          description="Suma de precios de venta activos"
        />
        <KpiCard
          icon={TrendingUp}
          title="Margen potencial"
          value={formatCurrency(totalMargin)}
          valueClassName="text-green-600 dark:text-green-400"
          description="Ganancia estimada en leads activos"
        />
        <KpiCard
          icon={Trophy}
          title="Ganados este mes"
          value={wonThisMonth}
          valueClassName={wonThisMonth > 0 ? "text-primary" : ""}
          description="Leads convertidos a crédito"
        />
      </div>

      <LeadsTable data={leads} />
    </PageShell>
  );
}
