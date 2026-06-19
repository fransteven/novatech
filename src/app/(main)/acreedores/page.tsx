import { getCreditorsAction } from "@/app/actions/creditor-actions";
import { getCashAccountsAction } from "@/app/actions/cash-actions";
import { CreditorsTable } from "@/components/acreedores/creditors-table";
import { HandCoins, DollarSign, Users, TrendingDown } from "lucide-react";
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

export default async function AcreedoresPage() {
  const [response, accountsRes] = await Promise.all([
    getCreditorsAction(),
    getCashAccountsAction(),
  ]);

  if (!response.success) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Acreedores</h1>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {response.error || "No se pudieron cargar los acreedores."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const creditors = response.data || [];
  const accounts =
    accountsRes.success && accountsRes.data ? accountsRes.data : [];

  const active = creditors.filter((c) => c.isActive);
  const totalOutstanding = creditors.reduce(
    (sum, c) => sum + c.outstandingBalance,
    0
  );
  const totalLent = creditors.reduce((sum, c) => sum + c.totalLent, 0);
  const totalPaid = creditors.reduce((sum, c) => sum + c.totalPaid, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Acreedores"
        description="Gestiona el capital externo del negocio. Registra préstamos recibidos, paga a los acreedores y lleva el historial completo."
        icon={HandCoins}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Users}
          title="Acreedores Activos"
          value={active.length}
          description="Con préstamos activos o histórico"
        />
        <KpiCard
          icon={TrendingDown}
          title="Saldo Adeudado"
          value={fmt(totalOutstanding)}
          valueClassName="text-destructive"
          description="Deuda total con todos los acreedores"
        />
        <KpiCard
          icon={DollarSign}
          title="Capital Recibido"
          value={fmt(totalLent)}
          valueClassName="text-primary"
          description="Total prestado históricamente"
        />
        <KpiCard
          icon={HandCoins}
          title="Total Pagado"
          value={fmt(totalPaid)}
          valueClassName="text-green-600 dark:text-green-400"
          description="Total devuelto a acreedores"
        />
      </div>

      <CreditorsTable data={creditors} accounts={accounts} />
    </div>
  );
}
