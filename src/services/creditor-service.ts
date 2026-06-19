/**
 * creditor-service.ts — Lógica de negocio de Acreedores.
 *
 * Un acreedor es una fuente de capitalización externa. Puede prestar dinero
 * al negocio (aumenta la deuda) y el negocio le paga de vuelta (reduce la deuda).
 * Cada préstamo tiene su propio esquema de compensación:
 *   none            — costo cero
 *   per_transaction — comisión fija por venta cerrada (se devenga manualmente con recordAccrual)
 *   interest_rate   — tasa de interés periódica (se devenga manualmente con recordAccrual)
 *
 * El saldo adeudado se calcula como agregación SQL sobre creditorMovements:
 *   SUM(amount WHERE kind IN ('loan','fee','interest')) − SUM(amount WHERE kind = 'payment')
 *
 * Todos los movimientos de Caja se integran en cashMovements (direction 'in'/'out').
 */

import { db } from "@/db";
import {
  creditors,
  creditorMovements,
  cashMovements,
  cashAccounts,
} from "@/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { money, toDbString } from "@/lib/money";
import type {
  CreateCreditorInput,
  AddLoanInput,
  RegisterCreditorPaymentInput,
  RecordAccrualInput,
} from "@/lib/validators/creditor-validator";

// ---------------------------------------------------------------------------
// createCreditor
// ---------------------------------------------------------------------------

export const createCreditor = async (
  data: CreateCreditorInput,
  userId?: string
) => {
  const [creditor] = await db
    .insert(creditors)
    .values({
      name: data.name,
      contactPhone: data.contactPhone || null,
      notes: data.notes || null,
      createdBy: userId ?? null,
    })
    .returning();
  return creditor;
};

// ---------------------------------------------------------------------------
// getCreditors — lista con saldo adeudado calculado por SQL
// ---------------------------------------------------------------------------

export const getCreditors = async () => {
  const result = await db
    .select({
      id: creditors.id,
      name: creditors.name,
      contactPhone: creditors.contactPhone,
      notes: creditors.notes,
      isActive: creditors.isActive,
      createdAt: creditors.createdAt,
      // Saldo adeudado = total prestado+devengado − total pagado
      outstandingBalance: sql<number>`
        COALESCE(
          SUM(CASE WHEN ${creditorMovements.kind} IN ('loan','fee','interest')
            THEN CAST(${creditorMovements.amount} AS DECIMAL) ELSE 0 END)
          - SUM(CASE WHEN ${creditorMovements.kind} = 'payment'
            THEN CAST(${creditorMovements.amount} AS DECIMAL) ELSE 0 END),
          0
        )
      `.mapWith(Number),
      // Total prestado históricamente (solo préstamos, sin accruals)
      totalLent: sql<number>`
        COALESCE(
          SUM(CASE WHEN ${creditorMovements.kind} = 'loan'
            THEN CAST(${creditorMovements.amount} AS DECIMAL) ELSE 0 END),
          0
        )
      `.mapWith(Number),
      // Total pagado históricamente
      totalPaid: sql<number>`
        COALESCE(
          SUM(CASE WHEN ${creditorMovements.kind} = 'payment'
            THEN CAST(${creditorMovements.amount} AS DECIMAL) ELSE 0 END),
          0
        )
      `.mapWith(Number),
      // Número de préstamos registrados
      loanCount: sql<number>`
        COALESCE(
          COUNT(CASE WHEN ${creditorMovements.kind} = 'loan' THEN 1 END),
          0
        )
      `.mapWith(Number),
    })
    .from(creditors)
    .leftJoin(creditorMovements, eq(creditorMovements.creditorId, creditors.id))
    .groupBy(creditors.id)
    .orderBy(desc(creditors.createdAt));

  return result;
};

// ---------------------------------------------------------------------------
// getCreditorDetail — detalle con historial de movimientos
// ---------------------------------------------------------------------------

export const getCreditorDetail = async (creditorId: string) => {
  const [creditor] = await db
    .select()
    .from(creditors)
    .where(eq(creditors.id, creditorId));

  if (!creditor) throw new Error("Acreedor no encontrado");

  const movements = await db
    .select()
    .from(creditorMovements)
    .where(eq(creditorMovements.creditorId, creditorId))
    .orderBy(desc(creditorMovements.occurredAt));

  // Calcular saldo localmente desde los movimientos
  const outstandingBalance = movements.reduce((acc, m) => {
    const amt = Number(m.amount);
    if (["loan", "fee", "interest"].includes(m.kind)) return acc + amt;
    if (m.kind === "payment") return acc - amt;
    return acc;
  }, 0);

  return {
    ...creditor,
    movements: movements.map((m) => ({
      ...m,
      amount: Number(m.amount),
      interestRate: m.interestRate ? Number(m.interestRate) : null,
      perTransactionFee: m.perTransactionFee
        ? Number(m.perTransactionFee)
        : null,
    })),
    outstandingBalance,
  };
};

// ---------------------------------------------------------------------------
// addLoan — el acreedor presta dinero al negocio
// ---------------------------------------------------------------------------

export const addLoan = async (data: AddLoanInput, userId?: string) => {
  return await db.transaction(async (tx) => {
    // Verificar que la cuenta de caja existe
    const [account] = await tx
      .select({ id: cashAccounts.id })
      .from(cashAccounts)
      .where(
        and(eq(cashAccounts.id, data.accountId), eq(cashAccounts.isActive, true))
      );
    if (!account) throw new Error("Cuenta de caja no encontrada o inactiva");

    // Verificar acreedor activo
    const [creditor] = await tx
      .select({ id: creditors.id, isActive: creditors.isActive })
      .from(creditors)
      .where(eq(creditors.id, data.creditorId));
    if (!creditor) throw new Error("Acreedor no encontrado");
    if (!creditor.isActive)
      throw new Error("El acreedor está inactivo. Reactívalo antes de registrar un préstamo");

    // Idempotencia: verificar que no existe ya este movimiento
    const [existing] = await tx
      .select({ id: creditorMovements.id })
      .from(creditorMovements)
      .where(eq(creditorMovements.idempotencyKey, data.idempotencyKey));
    if (existing) return { duplicate: true, id: existing.id };

    const amount = money(data.amount);

    // 1. Insertar movimiento de Caja (dinero ENTRA al negocio)
    const [cashMov] = await tx
      .insert(cashMovements)
      .values({
        accountId: data.accountId,
        direction: "in",
        amount: toDbString(amount),
        sourceType: "creditor_loan",
        sourceId: data.creditorId,
        paymentMethod: data.paymentMethod,
        occurredAt: data.occurredAt ?? new Date(),
        notes:
          data.notes ||
          `Préstamo recibido de acreedor`,
        createdBy: userId ?? null,
        status: "posted",
      })
      .returning({ id: cashMovements.id });

    // 2. Insertar movimiento en el libro del acreedor
    const [movement] = await tx
      .insert(creditorMovements)
      .values({
        creditorId: data.creditorId,
        kind: "loan",
        amount: toDbString(amount),
        compensationType: data.compensationType,
        interestRate:
          data.compensationType === "interest_rate" && data.interestRate
            ? data.interestRate.toFixed(4)
            : null,
        perTransactionFee:
          data.compensationType === "per_transaction" && data.perTransactionFee
            ? toDbString(data.perTransactionFee)
            : null,
        cashMovementId: cashMov.id,
        paymentMethod: data.paymentMethod,
        idempotencyKey: data.idempotencyKey,
        occurredAt: data.occurredAt ?? new Date(),
        notes: data.notes || null,
        createdBy: userId ?? null,
      })
      .returning();

    // 3. Actualizar updatedAt del acreedor
    await tx
      .update(creditors)
      .set({ updatedAt: new Date() })
      .where(eq(creditors.id, data.creditorId));

    return { duplicate: false, movement };
  });
};

// ---------------------------------------------------------------------------
// registerCreditorPayment — el negocio paga al acreedor
// ---------------------------------------------------------------------------

export const registerCreditorPayment = async (
  data: RegisterCreditorPaymentInput,
  userId?: string
) => {
  return await db.transaction(async (tx) => {
    // Verificar cuenta de caja
    const [account] = await tx
      .select({ id: cashAccounts.id })
      .from(cashAccounts)
      .where(
        and(eq(cashAccounts.id, data.accountId), eq(cashAccounts.isActive, true))
      );
    if (!account) throw new Error("Cuenta de caja no encontrada o inactiva");

    // Verificar acreedor
    const [creditor] = await tx
      .select({ id: creditors.id })
      .from(creditors)
      .where(eq(creditors.id, data.creditorId));
    if (!creditor) throw new Error("Acreedor no encontrado");

    // Idempotencia
    const [existing] = await tx
      .select({ id: creditorMovements.id })
      .from(creditorMovements)
      .where(eq(creditorMovements.idempotencyKey, data.idempotencyKey));
    if (existing) return { duplicate: true, id: existing.id };

    // Calcular saldo actual para validar
    const [balanceRow] = await tx
      .select({
        outstanding: sql<number>`
          COALESCE(
            SUM(CASE WHEN ${creditorMovements.kind} IN ('loan','fee','interest')
              THEN CAST(${creditorMovements.amount} AS DECIMAL) ELSE 0 END)
            - SUM(CASE WHEN ${creditorMovements.kind} = 'payment'
              THEN CAST(${creditorMovements.amount} AS DECIMAL) ELSE 0 END),
            0
          )
        `.mapWith(Number),
      })
      .from(creditorMovements)
      .where(eq(creditorMovements.creditorId, data.creditorId));

    const outstanding = balanceRow?.outstanding ?? 0;
    if (data.amount > outstanding + 0.01) {
      throw new Error(
        `El pago ($${data.amount.toLocaleString("es-CO")}) excede el saldo adeudado ($${outstanding.toLocaleString("es-CO")})`
      );
    }

    const amount = money(data.amount);

    // 1. Insertar movimiento de Caja (dinero SALE del negocio)
    const [cashMov] = await tx
      .insert(cashMovements)
      .values({
        accountId: data.accountId,
        direction: "out",
        amount: toDbString(amount),
        sourceType: "creditor_payment",
        sourceId: data.creditorId,
        paymentMethod: data.paymentMethod,
        occurredAt: data.occurredAt ?? new Date(),
        notes: data.notes || `Pago a acreedor`,
        createdBy: userId ?? null,
        status: "posted",
      })
      .returning({ id: cashMovements.id });

    // 2. Insertar movimiento en el libro del acreedor
    const [movement] = await tx
      .insert(creditorMovements)
      .values({
        creditorId: data.creditorId,
        kind: "payment",
        amount: toDbString(amount),
        cashMovementId: cashMov.id,
        paymentMethod: data.paymentMethod,
        idempotencyKey: data.idempotencyKey,
        occurredAt: data.occurredAt ?? new Date(),
        notes: data.notes || null,
        createdBy: userId ?? null,
      })
      .returning();

    // 3. Actualizar updatedAt del acreedor
    await tx
      .update(creditors)
      .set({ updatedAt: new Date() })
      .where(eq(creditors.id, data.creditorId));

    return { duplicate: false, movement };
  });
};

// ---------------------------------------------------------------------------
// recordAccrual — devengar comisión o interés manualmente
// ---------------------------------------------------------------------------

export const recordAccrual = async (
  data: RecordAccrualInput,
  userId?: string
) => {
  return await db.transaction(async (tx) => {
    // Verificar acreedor
    const [creditor] = await tx
      .select({ id: creditors.id })
      .from(creditors)
      .where(eq(creditors.id, data.creditorId));
    if (!creditor) throw new Error("Acreedor no encontrado");

    // Idempotencia
    const [existing] = await tx
      .select({ id: creditorMovements.id })
      .from(creditorMovements)
      .where(eq(creditorMovements.idempotencyKey, data.idempotencyKey));
    if (existing) return { duplicate: true, id: existing.id };

    const amount = money(data.amount);

    const [movement] = await tx
      .insert(creditorMovements)
      .values({
        creditorId: data.creditorId,
        kind: data.kind, // 'fee' | 'interest'
        amount: toDbString(amount),
        idempotencyKey: data.idempotencyKey,
        occurredAt: new Date(),
        notes: data.notes || null,
        createdBy: userId ?? null,
      })
      .returning();

    await tx
      .update(creditors)
      .set({ updatedAt: new Date() })
      .where(eq(creditors.id, data.creditorId));

    return { duplicate: false, movement };
  });
};

// ---------------------------------------------------------------------------
// toggleCreditorStatus — activar / desactivar acreedor
// ---------------------------------------------------------------------------

export const toggleCreditorStatus = async (
  creditorId: string,
  userId?: string
) => {
  const [creditor] = await db
    .select({ isActive: creditors.isActive })
    .from(creditors)
    .where(eq(creditors.id, creditorId));
  if (!creditor) throw new Error("Acreedor no encontrado");

  const [updated] = await db
    .update(creditors)
    .set({ isActive: !creditor.isActive, updatedAt: new Date() })
    .where(eq(creditors.id, creditorId))
    .returning();

  void userId; // audit trail expandable
  return updated;
};
