import { db } from "@/db";
import { cashAccounts, cashMovements, cashTransfers, cashReconciliations } from "@/db/schema";
import { eq, sql, and, desc } from "drizzle-orm";

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

type CreateCashAccountInput = {
  name: string;
  type: "cash" | "bank" | "wallet" | "card_processor";
  currency?: string;
  openingBalance?: number;
};

export const createCashAccount = async (data: CreateCashAccountInput) => {
  const result = await db
    .insert(cashAccounts)
    .values({
      name: data.name,
      type: data.type,
      currency: data.currency ?? "COP",
      openingBalance: (data.openingBalance ?? 0).toString(),
    })
    .returning();
  return result[0];
};

export const getCashAccounts = async () => {
  return await db
    .select()
    .from(cashAccounts)
    .where(eq(cashAccounts.isActive, true))
    .orderBy(cashAccounts.name);
};

export const getCashAccountBalance = async (accountId: string) => {
  const account = await db
    .select({
      name: cashAccounts.name,
      type: cashAccounts.type,
      currency: cashAccounts.currency,
      openingBalance: cashAccounts.openingBalance,
    })
    .from(cashAccounts)
    .where(eq(cashAccounts.id, accountId))
    .then((rows) => rows[0]);

  const movementsResult = await db
    .select({
      totalIn: sql<string>`COALESCE(SUM(CASE WHEN ${cashMovements.direction} = 'in' THEN ${cashMovements.amount}::numeric ELSE 0 END), 0)`,
      totalOut: sql<string>`COALESCE(SUM(CASE WHEN ${cashMovements.direction} = 'out' THEN ${cashMovements.amount}::numeric ELSE 0 END), 0)`,
    })
    .from(cashMovements)
    .where(
      and(
        eq(cashMovements.accountId, accountId),
        eq(cashMovements.status, "posted"),
      ),
    )
    .then((rows) => rows[0]);

  const balance =
    parseFloat(account.openingBalance ?? "0") +
    parseFloat(movementsResult.totalIn) -
    parseFloat(movementsResult.totalOut);

  return {
    accountId,
    balance,
    account: {
      name: account.name,
      type: account.type,
      currency: account.currency,
    },
  };
};

type CreateCashMovementInput = {
  accountId: string;
  direction: "in" | "out";
  amount: number;
  sourceType: string;
  sourceId?: string;
  paymentMethod?: string;
  referenceCode?: string;
  notes?: string;
  createdBy?: string;
  occurredAt?: Date;
};

export const createCashMovement = async (
  data: CreateCashMovementInput,
  dbOrTx: DbOrTx = db,
) => {
  const result = await dbOrTx
    .insert(cashMovements)
    .values({
      accountId: data.accountId,
      direction: data.direction,
      amount: data.amount.toString(),
      sourceType: data.sourceType,
      sourceId: data.sourceId,
      paymentMethod: data.paymentMethod ?? "cash",
      referenceCode: data.referenceCode,
      notes: data.notes,
      createdBy: data.createdBy,
      occurredAt: data.occurredAt ?? new Date(),
      status: "posted",
    })
    .returning();
  return result[0];
};

type CreateCashTransferInput = {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  feeAmount?: number;
  notes?: string;
  createdBy?: string;
};

export const createCashTransfer = async (data: CreateCashTransferInput) => {
  return await db.transaction(async (tx) => {
    const transferResult = await tx
      .insert(cashTransfers)
      .values({
        fromAccountId: data.fromAccountId,
        toAccountId: data.toAccountId,
        amount: data.amount.toString(),
        feeAmount: (data.feeAmount ?? 0).toString(),
        notes: data.notes,
        createdBy: data.createdBy,
        status: "posted",
      })
      .returning();
    const transfer = transferResult[0];

    const outMovement = await createCashMovement(
      {
        accountId: data.fromAccountId,
        direction: "out",
        amount: data.amount,
        sourceType: "transfer",
        sourceId: transfer.id,
        notes: data.notes,
        createdBy: data.createdBy,
      },
      tx,
    );

    const inMovement = await createCashMovement(
      {
        accountId: data.toAccountId,
        direction: "in",
        amount: data.amount,
        sourceType: "transfer",
        sourceId: transfer.id,
        notes: data.notes,
        createdBy: data.createdBy,
      },
      tx,
    );

    return { transfer, outMovement, inMovement };
  });
};

type CreateCashReconciliationInput = {
  accountId: string;
  periodStart: Date;
  periodEnd: Date;
  countedBalance: number;
  notes?: string;
  createdBy?: string;
};

export const createCashReconciliation = async (
  data: CreateCashReconciliationInput,
) => {
  const { balance: expectedBalance } = await getCashAccountBalance(
    data.accountId,
  );
  const difference = data.countedBalance - expectedBalance;

  const result = await db
    .insert(cashReconciliations)
    .values({
      accountId: data.accountId,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      expectedBalance: expectedBalance.toString(),
      countedBalance: data.countedBalance.toString(),
      difference: difference.toString(),
      status: "open",
      notes: data.notes,
    })
    .returning();
  return result[0];
};

export const getCashMovements = async (accountId: string, limit = 50) => {
  return await db
    .select({
      id: cashMovements.id,
      accountId: cashMovements.accountId,
      direction: cashMovements.direction,
      amount: cashMovements.amount,
      sourceType: cashMovements.sourceType,
      sourceId: cashMovements.sourceId,
      paymentMethod: cashMovements.paymentMethod,
      occurredAt: cashMovements.occurredAt,
      referenceCode: cashMovements.referenceCode,
      notes: cashMovements.notes,
      createdBy: cashMovements.createdBy,
      status: cashMovements.status,
      createdAt: cashMovements.createdAt,
      accountName: cashAccounts.name,
    })
    .from(cashMovements)
    .innerJoin(cashAccounts, eq(cashMovements.accountId, cashAccounts.id))
    .where(
      and(
        eq(cashMovements.accountId, accountId),
        eq(cashMovements.status, "posted"),
      ),
    )
    .orderBy(desc(cashMovements.occurredAt))
    .limit(limit);
};
