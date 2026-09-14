import { getExpensesAction } from "@/app/actions/expense-actions";
import { CreateExpenseModal } from "@/components/expenses/create-expense-modal";
import { ExpenseCategoryModal } from "@/components/expenses/expense-category-modal";
import { ExpensesTable } from "@/components/expenses/expenses-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Banknote } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { formatCurrency } from "@/lib/formatters";

export default async function ExpensesPage() {
  const { success, data, error } = await getExpensesAction();

  if (!success || !data) {
    return (
      <div className="container mx-auto space-y-8 p-8">
        <h1 className="text-3xl font-bold tracking-tight">Gastos</h1>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Error al cargar gastos: {error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const { expenses, categories } = data;

  const totalExpenses = expenses.reduce(
    (acc, curr) => acc + parseFloat(curr.amount),
    0,
  );

  return (
    <div className="container mx-auto space-y-8 p-8">
      <PageHeader
        title="Gastos"
        description="Gestiona y visualiza los gastos operativos del negocio."
        actions={
          <>
            <ExpenseCategoryModal />
            <CreateExpenseModal categories={categories} />
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Banknote}
          title="Gastos Totales"
          value={formatCurrency(totalExpenses)}
          description="Total histórico registrado"
        />
      </div>

      <ExpensesTable data={expenses} />
    </div>
  );
}
