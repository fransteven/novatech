import { getProfitsDataAction, getMonthlyProfitsAction } from "@/app/actions/profits-actions";
import { ProfitsKPIs } from "@/components/profits/profits-kpis";
import { MonthlyProfitsTable } from "@/components/profits/monthly-profits-table";
import { YearPicker } from "@/components/profits/year-picker";
import { PageHeader } from "@/components/ui/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, PiggyBank } from "lucide-react";
import { startOfYear, endOfYear } from "date-fns";

interface ProfitsPageProps {
  searchParams: Promise<{ year?: string }>;
}

export default async function ProfitsPage({ searchParams }: ProfitsPageProps) {
  const { year } = await searchParams;
  const selectedYear = year ? parseInt(year) : new Date().getFullYear();

  const from = startOfYear(new Date(selectedYear, 0, 1)).toISOString();
  const to = endOfYear(new Date(selectedYear, 0, 1)).toISOString();

  const [profitsResult, monthlyResult] = await Promise.all([
    getProfitsDataAction(from, to),
    getMonthlyProfitsAction(selectedYear),
  ]);

  if (!profitsResult.success || !profitsResult.data) {
    return (
      <div className="container mx-auto space-y-8 p-8">
        <h1 className="text-3xl font-bold tracking-tight">Ganancias</h1>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Error al cargar el reporte: {profitsResult.error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { kpis } = profitsResult.data;
  const monthlyData = monthlyResult.success ? monthlyResult.data! : [];

  return (
    <div className="container mx-auto space-y-8 p-8">
      <PageHeader
        title="Ganancias"
        description="Utilidad neta de NovaTech — desglose mensual."
        icon={PiggyBank}
        actions={<YearPicker year={year} />}
      />

      <ProfitsKPIs kpis={kpis} />

      <div>
        <h2 className="text-[15px] font-semibold mb-3">Desglose Mensual — {selectedYear}</h2>
        <MonthlyProfitsTable data={monthlyData} year={selectedYear} />
      </div>
    </div>
  );
}
