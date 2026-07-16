import { getLayawaysAction } from "@/app/actions/layaway-actions";
import { getCashAccountsAction } from "@/app/actions/cash-actions";
import { LayawaysTable } from "@/components/layaways/layaways-table";
import { SendDigestButton } from "@/components/layaways/send-digest-button";
import { Clock, DollarSign, AlertTriangle, TrendingUp } from "lucide-react";
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
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Apartados y Créditos</h1>
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
  const accounts = accountsRes.success && accountsRes.data ? accountsRes.data : [];

  const active = layaways.filter((l) => l.status === "active");
  const creditActive = active.filter((l) => l.type === "credito");
  const inMora = creditActive.filter((l) => l.subStatus === "en_mora").length;
  const highRisk = creditActive.filter((l) => l.riskLevel === "rojo").length;

  const totalPending = active.reduce((sum, l) => sum + (l.balance ?? 0), 0);
  const totalOutstanding = creditActive.reduce(
    (sum, l) => sum + (l.outstandingPrincipal ?? 0),
    0
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Apartados y Créditos"
        description="Gestiona apartados sin interés y créditos con amortización. Registra pagos y controla el riesgo."
        icon={Clock}
        actions={<SendDigestButton />}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Clock}
          title="Apartados Activos"
          value={active.length}
          description="Con saldo pendiente"
        />
        <KpiCard
          icon={DollarSign}
          title="Saldo por Cobrar"
          value={fmt(totalPending)}
          valueClassName="text-primary"
          description="Total en apartados activos"
        />
        <KpiCard
          icon={TrendingUp}
          title="Capital Insoluto"
          value={fmt(totalOutstanding)}
          valueClassName="text-blue-600 dark:text-blue-400"
          description="Capital pendiente en créditos"
        />
        <KpiCard
          icon={AlertTriangle}
          title="En mora / Riesgo alto"
          value={`${inMora} mora · ${highRisk} 🔴`}
          valueClassName={inMora > 0 || highRisk > 0 ? "text-destructive" : ""}
          description="Créditos que requieren atención"
        />
      </div>

      <LayawaysTable data={layaways} accounts={accounts} />
    </div>
  );
}
