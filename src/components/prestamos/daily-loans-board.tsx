"use client";

import { CollectionsBoard } from "@/components/credit/collections-board";
import type { CreditBoard } from "@/lib/credit/daily-board";
import { LoanPaymentSheet } from "./loan-payment-sheet";

type CashAccount = { id: string; name: string; balance?: number };

export function DailyLoansBoard({
  board,
  accounts,
}: {
  board: CreditBoard;
  accounts: CashAccount[];
}) {
  return (
    <CollectionsBoard
      board={board}
      title="Cobros del día"
      noun="préstamo"
      triggerClassName="h-11 px-5 font-medium shadow-sm"
      renderPayment={(entry, close) => (
        <LoanPaymentSheet
          open={entry !== null}
          onOpenChange={(o) => !o && close()}
          loanId={entry?.creditId ?? null}
          outstandingPrincipal={entry?.outstandingPrincipal ?? 0}
          installmentAmount={entry?.installmentAmount ?? 0}
          initialScheduleNumber={entry?.installments[0]}
          onSuccess={close}
          accounts={accounts}
        />
      )}
    />
  );
}
