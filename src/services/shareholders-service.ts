import { db } from "@/db";
import {
  shareholders,
  shareholderDistributions,
  shareholderDistributionItems,
  shareholderContributions,
} from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { money, toDbString } from "@/lib/money";
import type { AddContributionInput } from "@/lib/validators/shareholder-validator";

export const getShareholders = async () => {
  return await db
    .select({
      id: shareholders.id,
      fullName: shareholders.fullName,
      email: shareholders.email,
      ownershipPct: shareholders.ownershipPct,
      isActive: shareholders.isActive,
      createdAt: shareholders.createdAt,
      totalContributed: sql<number>`COALESCE(SUM(CAST(${shareholderContributions.amount} AS DECIMAL)), 0)`
        .mapWith(Number),
    })
    .from(shareholders)
    .leftJoin(
      shareholderContributions,
      eq(shareholderContributions.shareholderId, shareholders.id),
    )
    .where(eq(shareholders.isActive, true))
    .groupBy(shareholders.id)
    .orderBy(shareholders.fullName);
};

export const addContribution = async (data: AddContributionInput) => {
  const [shareholder] = await db
    .select()
    .from(shareholders)
    .where(eq(shareholders.id, data.shareholderId));

  if (!shareholder) throw new Error("Accionista no encontrado");
  if (!shareholder.isActive) throw new Error("El accionista no está activo");

  const amount = money(data.amount);

  const [contribution] = await db
    .insert(shareholderContributions)
    .values({
      shareholderId: data.shareholderId,
      amount: toDbString(amount),
      notes: data.notes,
      occurredAt: data.occurredAt ?? new Date(),
    })
    .returning();

  return contribution;
};

export const getDistributions = async () => {
  const distributions = await db
    .select()
    .from(shareholderDistributions)
    .orderBy(desc(shareholderDistributions.periodYear));

  const items = await db
    .select({
      id: shareholderDistributionItems.id,
      distributionId: shareholderDistributionItems.distributionId,
      shareholderId: shareholderDistributionItems.shareholderId,
      ownershipPct: shareholderDistributionItems.ownershipPct,
      amount: shareholderDistributionItems.amount,
      paidAt: shareholderDistributionItems.paidAt,
      cashMovementId: shareholderDistributionItems.cashMovementId,
      shareholderName: shareholders.fullName,
    })
    .from(shareholderDistributionItems)
    .innerJoin(
      shareholders,
      eq(shareholderDistributionItems.shareholderId, shareholders.id),
    );

  return distributions.map((d) => ({
    ...d,
    items: items.filter((i) => i.distributionId === d.id),
  }));
};

export const createDistribution = async ({
  periodYear,
  totalNetProfit,
  notes,
}: {
  periodYear: number;
  totalNetProfit: number;
  notes?: string;
}) => {
  return await db.transaction(async (tx) => {
    const activeShareholders = await tx
      .select()
      .from(shareholders)
      .where(eq(shareholders.isActive, true));

    if (activeShareholders.length === 0) {
      throw new Error("No hay accionistas activos registrados");
    }

    const [distribution] = await tx
      .insert(shareholderDistributions)
      .values({
        periodYear,
        totalNetProfit: totalNetProfit.toString(),
        notes,
        status: "pending",
      })
      .returning();

    for (const shareholder of activeShareholders) {
      const pct = Number(shareholder.ownershipPct);
      const amount = (totalNetProfit * pct) / 100;
      await tx.insert(shareholderDistributionItems).values({
        distributionId: distribution.id,
        shareholderId: shareholder.id,
        ownershipPct: shareholder.ownershipPct,
        amount: amount.toFixed(2),
      });
    }

    return distribution;
  });
};

export const markDistributionItemPaid = async (
  itemId: string,
  { cashMovementId }: { cashMovementId?: string } = {},
) => {
  const [updated] = await db
    .update(shareholderDistributionItems)
    .set({
      paidAt: new Date(),
      cashMovementId: cashMovementId ?? null,
    })
    .where(eq(shareholderDistributionItems.id, itemId))
    .returning();

  if (!updated) {
    throw new Error("Item de distribución no encontrado");
  }

  // If all items paid, mark distribution as paid
  const allItems = await db
    .select()
    .from(shareholderDistributionItems)
    .where(eq(shareholderDistributionItems.distributionId, updated.distributionId));

  const allPaid = allItems.every((i) => i.paidAt !== null);
  if (allPaid) {
    await db
      .update(shareholderDistributions)
      .set({ status: "paid", paidAt: new Date() })
      .where(eq(shareholderDistributions.id, updated.distributionId));
  }

  return updated;
};
