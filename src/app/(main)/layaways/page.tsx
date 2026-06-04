import { getLayawaysAction } from "@/app/actions/layaway-actions";
import { getCashAccountsAction } from "@/app/actions/cash-actions";
import { LayawaysTable } from "@/components/layaways/layaways-table";
import { Clock, DollarSign } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";

export const dynamic = "force-dynamic";

const fmt = (amount: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);

export default async function LayawaysPage() {
  const [response, accountsRes] = await Promise.all([
    getLayawaysAction(),
    getCashAccountsAction(),
  ]);

  if (!response.success) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Apartados</h1>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {response.error || "No se pudieron cargar los apartados."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const layaways = response.data || [];
  const accounts = (accountsRes.success && accountsRes.data) ? accountsRes.data : [];

  const activeCount = layaways.filter(
    (l) => l.status === "active" && l.balance > 0,
  ).length;
  const totalPending = layaways
    .filter((l) => l.status === "active")
    .reduce((sum, l) => sum + l.balance, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Apartados"
        description="Gestiona los artículos reservados, recibe abonos y controla los vencimientos."
        icon={Clock}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Clock}
          title="Apartados Activos"
          value={activeCount}
          description="Con saldo pendiente"
        />
        <KpiCard
          icon={DollarSign}
          title="Saldo por Cobrar"
          value={fmt(totalPending)}
          valueClassName="text-primary"
          description="Total en apartados activos"
        />
      </div>

      <LayawaysTable data={layaways} accounts={accounts} />
    </div>
  );
}
