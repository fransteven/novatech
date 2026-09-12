import { getLoansAction } from "@/app/actions/loan-actions";
import { getCashAccountsWithBalanceAction } from "@/app/actions/cash-actions";
import { LoansTable, type LoanItem } from "@/components/prestamos/loans-table";
import { NewLoanSheet } from "@/components/prestamos/new-loan-sheet";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Landmark,
  TrendingDown,
  AlertTriangle,
  Users,
  Percent,
  AlertCircle,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export default async function PrestamosPage() {
  const [loansRes, accountsRes] = await Promise.all([
    getLoansAction(),
    getCashAccountsWithBalanceAction(),
  ]);

  if (!loansRes.success) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Préstamos de Dinero</h1>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error al cargar módulo</AlertTitle>
          <AlertDescription>
            {loansRes.error || "No se pudieron cargar los préstamos de dinero."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const loans = (loansRes.data ?? []) as LoanItem[];
  const accounts = accountsRes.success && accountsRes.data?.accounts ? accountsRes.data.accounts : [];

  // Cálculos de KPIs
  const activeLoans = loans.filter((l) => l.status === "active");
  const inMoraLoans = activeLoans.filter((l) => l.subStatus === "en_mora");

  const totalOutstanding = activeLoans.reduce(
    (sum, l) => sum + (l.outstandingPrincipal || 0),
    0
  );

  const totalInMora = inMoraLoans.reduce(
    (sum, l) => sum + (l.outstandingPrincipal || 0),
    0
  );

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Préstamos de Dinero"
        description="Gestiona colocaciones de crédito en efectivo. Controla cuotas fijas bajo amortización francesa, semáforo de riesgo y recaudos."
        icon={Landmark}
        actions={<NewLoanSheet accounts={accounts} />}
      />

      {/* Grid de KPIs responsive: 2 cols en móvil, 4 en desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          icon={Landmark}
          title="Cartera Activa"
          value={formatCurrency(totalOutstanding)}
          description={`${activeLoans.length} préstamo${activeLoans.length === 1 ? "" : "s"} por cobrar`}
          valueClassName="text-primary font-bold"
        />

        <KpiCard
          icon={AlertTriangle}
          title="Cartera en Mora"
          value={formatCurrency(totalInMora)}
          description={`${inMoraLoans.length} cliente${inMoraLoans.length === 1 ? "" : "s"} con cuotas atrasadas`}
          valueClassName={totalInMora > 0 ? "text-amber-600 dark:text-amber-400 font-bold" : ""}
        />

        <KpiCard
          icon={Users}
          title="Préstamos Activos"
          value={activeLoans.length}
          description={`${loans.filter((l) => l.status === "completed").length} completados con éxito`}
        />

        <KpiCard
          icon={Percent}
          title="Clientes en Riesgo"
          value={loans.filter((l) => l.riskLevel === "rojo" && l.status === "active").length}
          description="Nivel de riesgo alto (rojo)"
          valueClassName={
            loans.some((l) => l.riskLevel === "rojo" && l.status === "active")
              ? "text-rose-600 dark:text-rose-400 font-bold"
              : ""
          }
        />
      </div>

      {/* Tabla con soporte de tarjetas móvil */}
      <LoansTable data={loans} accounts={accounts} />
    </div>
  );
}
