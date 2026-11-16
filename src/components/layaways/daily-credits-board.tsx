"use client";

import { CollectionsBoard } from "@/components/credit/collections-board";
import type { CreditBoard } from "@/lib/credit/daily-board";
import { CreditPaymentDialog } from "./credit-payment-dialog";

type CashAccount = { id: string; name: string };

export function DailyCreditsBoard({
  board,
  accounts,
}: {
  board: CreditBoard;
  accounts: CashAccount[];
}) {
  return (
    <CollectionsBoard
      board={board}
      title="Créditos del día"
      noun="crédito"
      renderPayment={(entry, close) => (
        <CreditPaymentDialog
          open={entry !== null}
          onOpenChange={(o) => !o && close()}
          layawayId={entry?.creditId ?? null}
          outstandingPrincipal={entry?.outstandingPrincipal ?? 0}
          installmentAmount={entry?.installmentAmount ?? 0}
          onSuccess={close}
          accounts={accounts}
        />
      )}
    />
  );
}
