import { Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { CashKpis } from "@/components/cash/cash-kpis";
import { CashAccountsGrid } from "@/components/cash/cash-accounts-grid";
import { CashMovementsTable } from "@/components/cash/cash-movements-table";
import { CreateAccountDialog } from "@/components/cash/create-account-dialog";
import { CreateMovementDialog } from "@/components/cash/create-movement-dialog";
import { TransferDialog } from "@/components/cash/transfer-dialog";
import { ReconciliationDialog } from "@/components/cash/reconciliation-dialog";
import {
  getCashAccountsWithBalanceAction,
  getCashFlowSummaryAction,
} from "@/app/actions/cash-actions";

export const dynamic = "force-dynamic";

export default async function CashPage() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const [accountsResult, summaryResult] = await Promise.all([
    getCashAccountsWithBalanceAction(),
    getCashFlowSummaryAction(monthStart, monthEnd),
  ]);

  const accounts = accountsResult.data?.accounts ?? [];
  const totalBalance = accountsResult.data?.totalBalance ?? 0;
  const summary = summaryResult.data ?? {
    totalIn: 0,
    totalOut: 0,
    netFlow: 0,
    movementCount: 0,
  };

  if (accounts.length === 0) {
    return (
      <div className="space-y-5 p-4">
        <PageHeader
          title="Caja"
          description="Controla el dinero por cuenta — efectivo, bancos, wallets y datáfonos."
          actions={<CreateAccountDialog />}
        />
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div
            className="w-16 h-16 rounded-[14px] flex items-center justify-center mb-5"
            style={{
              background: "oklch(0.58 0.19 265 / 0.1)",
              color: "oklch(0.58 0.19 265)",
            }}
          >
            <Wallet className="h-8 w-8" />
          </div>
          <h3 className="text-[18px] font-semibold mb-2">Sin cuentas de caja</h3>
          <p className="text-muted-foreground text-sm max-w-xs mb-6">
            Crea tu primera cuenta para empezar a registrar movimientos de
            efectivo, transferencias y pagos.
          </p>
          <CreateAccountDialog />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4">
      <PageHeader
        title="Caja"
        description="Controla el dinero por cuenta — efectivo, bancos, wallets y datáfonos."
        actions={
          <>
            <CreateAccountDialog />
            <CreateMovementDialog accounts={accounts} />
            <TransferDialog accounts={accounts} />
            <ReconciliationDialog accounts={accounts} />
          </>
        }
      />
      <CashKpis
        totalBalance={totalBalance}
        totalIn={summary.totalIn}
        totalOut={summary.totalOut}
        netFlow={summary.netFlow}
      />
      <CashAccountsGrid accounts={accounts} />
      <CashMovementsTable accounts={accounts} />
    </div>
  );
}
