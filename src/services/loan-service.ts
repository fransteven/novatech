import { db } from "@/db";
import {
  loans,
  loanSchedule,
  loanPayments,
  customers,
  user,
  cashAccounts,
  cashMovements,
  otherIncome,
  expenses,
  expenseCategories,
  riskHistory,
} from "@/db/schema";
import { eq, sql, and, desc, asc, or, ilike } from "drizzle-orm";
import { generateSchedule, type ScheduleEntry } from "@/lib/credit/amortization";
import {
  applyCuota,
  applySoloInteres,
  applyAbonoCuota,
  applyAbonoCapital,
} from "@/lib/credit/payments";
import { computeDpd } from "@/lib/credit/dpd";
import { computeRiskScore } from "@/lib/credit/risk";
import { DEFAULT_RISK_CONFIG } from "@/lib/credit/risk-config";
import { createNotification } from "@/services/notification-service";
import { recordAudit } from "@/services/audit-service";
import { roundCOP, sub, toDbString } from "@/lib/money";
import { formatCurrency } from "@/lib/formatters";
import type {
  CreateLoanInput,
  RegisterLoanPaymentInput,
} from "@/lib/validators/loan-validator";

export type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

// ---------------------------------------------------------------------------
// 1. createLoan — Desembolso de préstamo en una transacción atómica
// ---------------------------------------------------------------------------

export const createLoan = async (data: CreateLoanInput, userId?: string) => {
  return await db.transaction(async (tx) => {
    // 1. Idempotencia por idempotencyKey
    const [existing] = await tx
      .select()
      .from(loans)
      .where(eq(loans.idempotencyKey, data.idempotencyKey))
      .limit(1);

    if (existing) {
      return { loan: existing, duplicate: true };
    }

    // 2. Validar que la cuenta de origen exista y tenga fondos suficientes
    const [account] = await tx
      .select({
        id: cashAccounts.id,
        name: cashAccounts.name,
        openingBalance: cashAccounts.openingBalance,
      })
      .from(cashAccounts)
      .where(eq(cashAccounts.id, data.accountId))
      .limit(1);

    if (!account) {
      throw new Error("La cuenta de caja especificada no existe");
    }

    const movementsResult = await tx
      .select({
        totalIn: sql<string>`COALESCE(SUM(CASE WHEN ${cashMovements.direction} = 'in' THEN ${cashMovements.amount}::numeric ELSE 0 END), 0)`,
        totalOut: sql<string>`COALESCE(SUM(CASE WHEN ${cashMovements.direction} = 'out' THEN ${cashMovements.amount}::numeric ELSE 0 END), 0)`,
      })
      .from(cashMovements)
      .where(
        and(
          eq(cashMovements.accountId, data.accountId),
          eq(cashMovements.status, "posted")
        )
      );

    const currentBalance =
      parseFloat(account.openingBalance ?? "0") +
      parseFloat(movementsResult[0]?.totalIn ?? "0") -
      parseFloat(movementsResult[0]?.totalOut ?? "0");

    if (currentBalance < data.principalAmount) {
      throw new Error(
        `Fondos insuficientes en la cuenta "${account.name}". Saldo disponible: ${formatCurrency(
          currentBalance
        )}, Monto a desembolsar: ${formatCurrency(data.principalAmount)}`
      );
    }

    // 3. Tasa obligatoria sin default silencioso
    if (typeof data.interestRate !== "number" || data.interestRate <= 0) {
      throw new Error(
        "La tasa de interés mensual pactada es requerida y debe ser mayor a cero"
      );
    }

    // 4. Generar cronograma francés sobre saldo insoluto
    const scheduleEntries = generateSchedule({
      principal: data.principalAmount,
      monthlyRate: data.interestRate,
      termMonths: data.termMonths,
      startDate: new Date(data.firstDueDate),
    });

    const installmentAmount = scheduleEntries[0].totalAmount;
    const lastDueDate = scheduleEntries[scheduleEntries.length - 1].dueDate;

    // 5. Insertar cabecera de préstamo
    const [loan] = await tx
      .insert(loans)
      .values({
        customerId: data.customerId,
        createdBy: userId ?? null,
        status: "active",
        subStatus: "al_dia",
        principalAmount: toDbString(data.principalAmount),
        outstandingPrincipal: toDbString(data.principalAmount),
        interestRate: data.interestRate.toFixed(4),
        termMonths: data.termMonths,
        installmentAmount: toDbString(installmentAmount),
        originationFee: toDbString(data.originationFee ?? 0),
        disbursedAt: new Date(),
        expiresAt: lastDueDate,
        collateral: data.collateral ?? null,
        notes: data.notes ?? null,
        riskScore: 0,
        riskLevel: "verde",
        idempotencyKey: data.idempotencyKey,
      })
      .returning();

    // 6. Insertar cuotas en loan_schedule
    await tx.insert(loanSchedule).values(
      scheduleEntries.map((e) => ({
        loanId: loan.id,
        number: e.number,
        dueDate: e.dueDate,
        principal: toDbString(e.principal),
        interest: toDbString(e.interest),
        totalAmount: toDbString(e.totalAmount),
        remainingBalance: toDbString(e.remainingBalance),
        status: "pendiente",
        paidAmount: "0",
      }))
    );

    // 7. Movimiento de caja: salida por desembolso
    await tx.insert(cashMovements).values({
      accountId: data.accountId,
      direction: "out",
      amount: toDbString(data.principalAmount),
      sourceType: "loan_disbursement",
      sourceId: loan.id,
      paymentMethod: data.paymentMethod ?? "cash",
      notes: `Desembolso de préstamo ${loan.id}`,
      createdBy: userId ?? null,
      status: "posted",
    });

    // 8. Si se cobró comisión de originación: entrada a caja y asiento en other_income
    if (data.originationFee && data.originationFee > 0) {
      await tx.insert(cashMovements).values({
        accountId: data.accountId,
        direction: "in",
        amount: toDbString(data.originationFee),
        sourceType: "loan_origination_fee",
        sourceId: loan.id,
        paymentMethod: data.paymentMethod ?? "cash",
        notes: `Comisión de originación de préstamo ${loan.id}`,
        createdBy: userId ?? null,
        status: "posted",
      });

      await tx.insert(otherIncome).values({
        concept: "comision_originacion",
        amount: toDbString(data.originationFee),
        date: new Date(),
        description: `Comisión de originación préstamo ${loan.id}`,
        loanId: loan.id,
        createdBy: userId ?? null,
      });
    }

    return { loan, duplicate: false };
  });
};

// ---------------------------------------------------------------------------
// 2. registerLoanPayment — Cobro de cuota, abono o solo interés
// ---------------------------------------------------------------------------

export const registerLoanPayment = async (data: RegisterLoanPaymentInput) => {
  return await db.transaction(async (tx) => {
    // 1. Cargar préstamo
    const [loan] = await tx
      .select()
      .from(loans)
      .where(eq(loans.id, data.loanId))
      .limit(1);

    if (!loan) throw new Error("Préstamo no encontrado");
    if (loan.status !== "active") {
      throw new Error(`El préstamo no está activo (Estado: ${loan.status})`);
    }

    // 2. Idempotencia en pagos
    const existing = await tx
      .select({ id: loanPayments.id })
      .from(loanPayments)
      .where(eq(loanPayments.idempotencyKey, data.idempotencyKey))
      .limit(1);
    if (existing.length > 0) {
      return { success: true, duplicate: true };
    }

    // 3. Cargar cronograma
    const sched = await tx
      .select()
      .from(loanSchedule)
      .where(eq(loanSchedule.loanId, data.loanId))
      .orderBy(asc(loanSchedule.number));

    const schedEntries: ScheduleEntry[] = sched.map((s) => ({
      number: s.number,
      dueDate: new Date(s.dueDate),
      status: s.status as "pendiente" | "pagada" | "vencida",
      principal: Number(s.principal),
      interest: Number(s.interest),
      totalAmount: Number(s.totalAmount),
      remainingBalance: Number(s.remainingBalance),
      paidAt: s.paidAt ? new Date(s.paidAt) : null,
      paidAmount: Number(s.paidAmount ?? 0),
    }));

    let principalPortion = 0;
    let interestPortion = 0;
    let newScheduleEntries = schedEntries;
    let newOutstandingPrincipal = Number(loan.outstandingPrincipal);
    let newInstallmentAmount: number | null = null;

    // 4. Aplicar tipo de pago
    if (data.type === "cuota") {
      if (!data.scheduleNumber) throw new Error("Se requiere el número de cuota");
      const result = applyCuota(schedEntries, data.scheduleNumber);
      principalPortion = result.principalPortion;
      interestPortion = result.interestPortion;
      newScheduleEntries = result.schedule;
      newOutstandingPrincipal = roundCOP(
        sub(newOutstandingPrincipal, result.principalPortion)
      ).toNumber();
    } else if (data.type === "solo_interes") {
      if (!data.scheduleNumber) throw new Error("Se requiere el número de cuota");
      const result = applySoloInteres(schedEntries, data.scheduleNumber);
      interestPortion = result.interest;
      // Cronograma no avanza
    } else if (data.type === "abono_cuota") {
      if (!data.scheduleNumber) throw new Error("Se requiere el número de cuota");
      const result = applyAbonoCuota(schedEntries, data.scheduleNumber, data.amount);
      principalPortion = result.principalPortion;
      interestPortion = result.interestPortion;
      newScheduleEntries = result.schedule;
      newOutstandingPrincipal = roundCOP(
        sub(newOutstandingPrincipal, result.principalPortion)
      ).toNumber();
    } else if (data.type === "abono_capital") {
      if (!data.capitalStrategy) {
        throw new Error("Se requiere la estrategia de abono a capital");
      }
      const monthlyRate = Number(loan.interestRate);
      if (!(monthlyRate > 0)) {
        throw new Error(
          "El préstamo no tiene una tasa de interés válida para regenerar el cronograma"
        );
      }

      const result = applyAbonoCapital(
        { schedule: schedEntries, outstandingPrincipal: newOutstandingPrincipal },
        data.amount,
        data.capitalStrategy,
        monthlyRate,
        new Date()
      );
      principalPortion = data.amount;
      newScheduleEntries = result.newSchedule;
      newOutstandingPrincipal = result.newOutstandingPrincipal;
      newInstallmentAmount = result.newInstallmentAmount;
    }

    // 5. Registrar movimiento de caja (entrada)
    const [cm] = await tx
      .insert(cashMovements)
      .values({
        accountId: data.accountId,
        direction: "in",
        sourceType: "loan_payment",
        sourceId: data.loanId,
        paymentMethod: data.paymentMethod ?? "cash",
        amount: toDbString(data.amount),
        referenceCode: data.referenceCode ?? null,
        notes: data.notes ?? `Pago préstamo: ${data.type}`,
        createdBy: data.userId ?? null,
        status: "posted",
      })
      .returning();

    // 6. Registrar en loanPayments
    await tx.insert(loanPayments).values({
      loanId: data.loanId,
      type: data.type,
      amount: toDbString(data.amount),
      principalPortion: toDbString(principalPortion),
      interestPortion: toDbString(interestPortion),
      scheduleNumber: data.scheduleNumber ?? null,
      capitalStrategy: data.capitalStrategy ?? null,
      cashMovementId: cm.id,
      idempotencyKey: data.idempotencyKey,
      createdBy: data.userId ?? null,
    });

    // 7. Persistir cronograma actualizado
    if (data.type === "cuota") {
      const paid = newScheduleEntries.find((e) => e.number === data.scheduleNumber);
      if (paid) {
        await tx
          .update(loanSchedule)
          .set({ status: "pagada", paidAt: paid.paidAt ?? new Date() })
          .where(
            and(
              eq(loanSchedule.loanId, data.loanId),
              eq(loanSchedule.number, paid.number)
            )
          );
      }
    } else if (data.type === "abono_cuota") {
      const updated = newScheduleEntries.find((e) => e.number === data.scheduleNumber);
      if (updated) {
        await tx
          .update(loanSchedule)
          .set({
            paidAmount: toDbString(updated.paidAmount),
            status: updated.status,
            paidAt: updated.paidAt,
          })
          .where(
            and(
              eq(loanSchedule.loanId, data.loanId),
              eq(loanSchedule.number, updated.number)
            )
          );
      }
    } else if (data.type === "abono_capital") {
      await tx
        .delete(loanSchedule)
        .where(eq(loanSchedule.loanId, data.loanId));
      await tx.insert(loanSchedule).values(
        newScheduleEntries.map((e) => ({
          loanId: data.loanId,
          number: e.number,
          dueDate: e.dueDate,
          principal: toDbString(e.principal),
          interest: toDbString(e.interest),
          totalAmount: toDbString(e.totalAmount),
          remainingBalance: toDbString(e.remainingBalance),
          status: e.status,
          paidAt: e.paidAt,
          paidAmount: toDbString(e.paidAmount),
        }))
      );
    }

    // 8. Actualizar saldo insoluto y cuota si cambió
    await tx
      .update(loans)
      .set({
        outstandingPrincipal: toDbString(newOutstandingPrincipal),
        ...(newInstallmentAmount !== null
          ? { installmentAmount: toDbString(newInstallmentAmount) }
          : {}),
      })
      .where(eq(loans.id, data.loanId));

    // 9. Verificar si el préstamo se liquidó por completo
    const allPaid = newScheduleEntries.every((e) => e.status === "pagada");
    if (allPaid || newOutstandingPrincipal <= 0) {
      await tx
        .update(loans)
        .set({
          status: "completed",
          outstandingPrincipal: "0.00",
          subStatus: "al_dia",
        })
        .where(eq(loans.id, data.loanId));
    } else {
      // 10. Recalcular estado de riesgo y mora
      await recomputeLoanStatus(tx, data.loanId);
    }

    return { success: true, duplicate: false };
  });
};

// ---------------------------------------------------------------------------
// 3. recomputeLoanStatus — DPD, mora, semáforo de riesgo y notificaciones
// ---------------------------------------------------------------------------

export async function recomputeLoanStatus(
  tx: DbExecutor,
  loanId: string
): Promise<void> {
  const sched = await tx
    .select()
    .from(loanSchedule)
    .where(eq(loanSchedule.loanId, loanId))
    .orderBy(asc(loanSchedule.number));

  if (sched.length === 0) return;

  const today = new Date();

  // Marcar cuotas vencidas
  for (const entry of sched) {
    if (entry.status === "pendiente" && new Date(entry.dueDate) < today) {
      await tx
        .update(loanSchedule)
        .set({ status: "vencida" })
        .where(eq(loanSchedule.id, entry.id));
    }
  }

  const [loan] = await tx
    .select()
    .from(loans)
    .where(eq(loans.id, loanId))
    .limit(1);
  if (!loan || loan.status !== "active") return;

  const schedEntries: ScheduleEntry[] = sched.map((s) => ({
    number: s.number,
    dueDate: new Date(s.dueDate),
    status: (new Date(s.dueDate) < today && s.status === "pendiente"
      ? "vencida"
      : s.status) as "pendiente" | "pagada" | "vencida",
    principal: Number(s.principal),
    interest: Number(s.interest),
    totalAmount: Number(s.totalAmount),
    remainingBalance: Number(s.remainingBalance),
    paidAt: s.paidAt ? new Date(s.paidAt) : null,
    paidAmount: Number(s.paidAmount ?? 0),
  }));

  const dpd = computeDpd(schedEntries, today);

  const lateInstallments = sched.filter(
    (s) => s.status === "pagada" && s.paidAt && new Date(s.paidAt) > new Date(s.dueDate)
  ).length;

  const soloInteresRows = await tx
    .select({ count: sql<number>`COUNT(*)`.mapWith(Number) })
    .from(loanPayments)
    .where(
      and(
        eq(loanPayments.loanId, loanId),
        eq(loanPayments.type, "solo_interes")
      )
    );
  const soloInteresCount = soloInteresRows[0]?.count ?? 0;

  const recentPayments = await tx
    .select({ type: loanPayments.type })
    .from(loanPayments)
    .where(eq(loanPayments.loanId, loanId))
    .orderBy(desc(loanPayments.createdAt))
    .limit(10);

  let consecutiveSoloInteres = 0;
  for (const p of recentPayments) {
    if (p.type === "solo_interes") consecutiveSoloInteres++;
    else break;
  }

  const originalPrincipal = Number(loan.principalAmount);
  const outstanding = Number(loan.outstandingPrincipal);
  const pctPrincipalPaid =
    originalPrincipal > 0
      ? Math.round(((originalPrincipal - outstanding) / originalPrincipal) * 100)
      : 0;

  const { score, level } = computeRiskScore(
    {
      dpd,
      lateInstallments,
      soloInteresCount,
      consecutiveSoloInteres,
      pctPrincipalPaid,
    },
    DEFAULT_RISK_CONFIG
  );

  const newSubStatus = dpd > 0 ? "en_mora" : "al_dia";
  const previousScore = loan.riskScore ?? 0;
  const previousLevel = loan.riskLevel ?? "verde";
  const previousSubStatus = loan.subStatus;

  await tx
    .update(loans)
    .set({ riskScore: score, riskLevel: level, subStatus: newSubStatus })
    .where(eq(loans.id, loanId));

  if (score !== previousScore) {
    await tx.insert(riskHistory).values({
      loanId,
      previousScore,
      newScore: score,
      level,
      reason: `DPD=${dpd}, atrasos=${lateInstallments}, solo_interes=${soloInteresCount}, consecutivos=${consecutiveSoloInteres}, %capital=${pctPrincipalPaid}`,
    });
  }

  if (newSubStatus === "en_mora" && previousSubStatus !== "en_mora") {
    await createNotification({
      type: "mora",
      loanId,
      title: "Préstamo en mora",
      message: `Préstamo con ${dpd} días de atraso.`,
      severity: "danger",
      dedupeKey: `loan:mora:${loanId}:${Math.floor(dpd / 7)}`,
    });
  }

  if (level === "rojo" && previousLevel !== "rojo") {
    await createNotification({
      type: "riesgo_rojo",
      loanId,
      title: "Préstamo en nivel Rojo",
      message: `Score de riesgo: ${score}. Requiere atención prioritaria.`,
      severity: "danger",
      dedupeKey: `loan:riesgo_rojo:${loanId}:${score}`,
    });
  }
}

// ---------------------------------------------------------------------------
// 4. getLoans — Lista consolidada con agregados por subconsultas
// ---------------------------------------------------------------------------

export interface GetLoansFilter {
  query?: string;
  status?: string; // 'all' | 'active' | 'en_mora' | 'completed' | 'defaulted' | 'rojo'
}

export const getLoans = async (filter?: GetLoansFilter) => {
  const result = await db
    .select({
      id: loans.id,
      status: loans.status,
      subStatus: loans.subStatus,
      principalAmount: sql<number>`CAST(${loans.principalAmount} AS DECIMAL)`.mapWith(Number),
      outstandingPrincipal: sql<number>`CAST(${loans.outstandingPrincipal} AS DECIMAL)`.mapWith(Number),
      interestRate: sql<number>`CAST(${loans.interestRate} AS DECIMAL)`.mapWith(Number),
      termMonths: loans.termMonths,
      installmentAmount: sql<number>`CAST(${loans.installmentAmount} AS DECIMAL)`.mapWith(Number),
      originationFee: sql<number>`CAST(${loans.originationFee} AS DECIMAL)`.mapWith(Number),
      disbursedAt: loans.disbursedAt,
      expiresAt: loans.expiresAt,
      createdAt: loans.createdAt,
      collateral: loans.collateral,
      notes: loans.notes,
      riskScore: loans.riskScore,
      riskLevel: loans.riskLevel,
      writeOffAmount: sql<number | null>`CAST(${loans.writeOffAmount} AS DECIMAL)`.mapWith((val) =>
        val != null ? Number(val) : null
      ),
      writtenOffAt: loans.writtenOffAt,
      customerId: customers.id,
      customerName: customers.name,
      customerDocument: customers.documentId,
      customerPhone: customers.phone,
      customerEmail: customers.email,
      totalPaid: sql<number>`
        COALESCE(
          (SELECT SUM(CAST(amount AS DECIMAL)) FROM loan_payments WHERE loan_payments.loan_id = loans.id),
          0
        )
      `.mapWith(Number),
      overdueInstallmentsCount: sql<number>`
        COALESCE(
          (SELECT COUNT(*) FROM loan_schedule WHERE loan_schedule.loan_id = loans.id AND loan_schedule.status = 'vencida'),
          0
        )
      `.mapWith(Number),
      paidInstallmentsCount: sql<number>`
        COALESCE(
          (SELECT COUNT(*) FROM loan_schedule WHERE loan_schedule.loan_id = loans.id AND loan_schedule.status = 'pagada'),
          0
        )
      `.mapWith(Number),
      totalInstallmentsCount: sql<number>`
        COALESCE(
          (SELECT COUNT(*) FROM loan_schedule WHERE loan_schedule.loan_id = loans.id),
          0
        )
      `.mapWith(Number),
    })
    .from(loans)
    .innerJoin(customers, eq(loans.customerId, customers.id))
    .orderBy(desc(loans.createdAt));

  let filtered = result;

  if (filter?.query) {
    const q = filter.query.toLowerCase().trim();
    filtered = filtered.filter(
      (l) =>
        l.customerName.toLowerCase().includes(q) ||
        (l.customerDocument && l.customerDocument.toLowerCase().includes(q)) ||
        (l.customerPhone && l.customerPhone.includes(q)) ||
        (l.collateral && l.collateral.toLowerCase().includes(q))
    );
  }

  if (filter?.status && filter.status !== "all") {
    if (filter.status === "en_mora") {
      filtered = filtered.filter((l) => l.status === "active" && l.subStatus === "en_mora");
    } else if (filter.status === "al_dia") {
      filtered = filtered.filter((l) => l.status === "active" && l.subStatus === "al_dia");
    } else if (filter.status === "rojo") {
      filtered = filtered.filter((l) => l.riskLevel === "rojo");
    } else {
      filtered = filtered.filter((l) => l.status === filter.status);
    }
  }

  return filtered;
};

// ---------------------------------------------------------------------------
// 5. getLoanDetail — Cabecera, cliente, cronograma y ledger de pagos
// ---------------------------------------------------------------------------

export const getLoanDetail = async (loanId: string) => {
  const [loan] = await db
    .select({
      id: loans.id,
      status: loans.status,
      subStatus: loans.subStatus,
      principalAmount: sql<number>`CAST(${loans.principalAmount} AS DECIMAL)`.mapWith(Number),
      outstandingPrincipal: sql<number>`CAST(${loans.outstandingPrincipal} AS DECIMAL)`.mapWith(Number),
      interestRate: sql<number>`CAST(${loans.interestRate} AS DECIMAL)`.mapWith(Number),
      termMonths: loans.termMonths,
      installmentAmount: sql<number>`CAST(${loans.installmentAmount} AS DECIMAL)`.mapWith(Number),
      originationFee: sql<number>`CAST(${loans.originationFee} AS DECIMAL)`.mapWith(Number),
      disbursedAt: loans.disbursedAt,
      expiresAt: loans.expiresAt,
      createdAt: loans.createdAt,
      collateral: loans.collateral,
      notes: loans.notes,
      riskScore: loans.riskScore,
      riskLevel: loans.riskLevel,
      writeOffAmount: sql<number | null>`CAST(${loans.writeOffAmount} AS DECIMAL)`.mapWith((val) =>
        val != null ? Number(val) : null
      ),
      writtenOffAt: loans.writtenOffAt,
      idempotencyKey: loans.idempotencyKey,
      customerId: customers.id,
      customerName: customers.name,
      customerDocument: customers.documentId,
      customerPhone: customers.phone,
      customerEmail: customers.email,
    })
    .from(loans)
    .innerJoin(customers, eq(loans.customerId, customers.id))
    .where(eq(loans.id, loanId))
    .limit(1);

  if (!loan) return null;

  const schedule = await db
    .select({
      id: loanSchedule.id,
      number: loanSchedule.number,
      dueDate: loanSchedule.dueDate,
      principal: sql<number>`CAST(${loanSchedule.principal} AS DECIMAL)`.mapWith(Number),
      interest: sql<number>`CAST(${loanSchedule.interest} AS DECIMAL)`.mapWith(Number),
      totalAmount: sql<number>`CAST(${loanSchedule.totalAmount} AS DECIMAL)`.mapWith(Number),
      remainingBalance: sql<number>`CAST(${loanSchedule.remainingBalance} AS DECIMAL)`.mapWith(Number),
      status: loanSchedule.status,
      paidAt: loanSchedule.paidAt,
      paidAmount: sql<number>`CAST(${loanSchedule.paidAmount} AS DECIMAL)`.mapWith(Number),
    })
    .from(loanSchedule)
    .where(eq(loanSchedule.loanId, loanId))
    .orderBy(asc(loanSchedule.number));

  const payments = await db
    .select({
      id: loanPayments.id,
      type: loanPayments.type,
      amount: sql<number>`CAST(${loanPayments.amount} AS DECIMAL)`.mapWith(Number),
      principalPortion: sql<number>`CAST(${loanPayments.principalPortion} AS DECIMAL)`.mapWith(Number),
      interestPortion: sql<number>`CAST(${loanPayments.interestPortion} AS DECIMAL)`.mapWith(Number),
      scheduleNumber: loanPayments.scheduleNumber,
      capitalStrategy: loanPayments.capitalStrategy,
      cashMovementId: loanPayments.cashMovementId,
      createdAt: loanPayments.createdAt,
      createdByName: user.name,
    })
    .from(loanPayments)
    .leftJoin(user, eq(loanPayments.createdBy, user.id))
    .where(eq(loanPayments.loanId, loanId))
    .orderBy(desc(loanPayments.createdAt));

  const riskLogs = await db
    .select({
      id: riskHistory.id,
      previousScore: riskHistory.previousScore,
      newScore: riskHistory.newScore,
      level: riskHistory.level,
      reason: riskHistory.reason,
      occurredAt: riskHistory.occurredAt,
    })
    .from(riskHistory)
    .where(eq(riskHistory.loanId, loanId))
    .orderBy(desc(riskHistory.occurredAt));

  return {
    ...loan,
    schedule,
    payments,
    riskLogs,
  };
};

// ---------------------------------------------------------------------------
// 6. writeOffLoan — Castigo de cartera manual
// ---------------------------------------------------------------------------

export const writeOffLoan = async (
  loanId: string,
  reason: string,
  userId: string,
  userName?: string
) => {
  return await db.transaction(async (tx) => {
    const [loan] = await tx
      .select()
      .from(loans)
      .where(eq(loans.id, loanId))
      .limit(1);

    if (!loan) throw new Error("Préstamo no encontrado");
    if (loan.status !== "active") {
      throw new Error(`El préstamo no está activo (Estado actual: ${loan.status})`);
    }

    let [category] = await tx
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.name, "Cartera castigada"))
      .limit(1);

    if (!category) {
      [category] = await tx
        .insert(expenseCategories)
        .values({
          name: "Cartera castigada",
          description: "Pérdida por préstamos o créditos incobrables declarados en default",
        })
        .returning();
    }

    const writtenOffAmount = loan.outstandingPrincipal;

    await tx
      .update(loans)
      .set({
        status: "defaulted",
        writeOffAmount: writtenOffAmount,
        writtenOffAt: new Date(),
      })
      .where(eq(loans.id, loanId));

    await tx.insert(expenses).values({
      categoryId: category.id,
      amount: writtenOffAmount,
      description: `Castigo de cartera préstamo ${loan.id}: ${reason}`,
      date: new Date(),
      paymentMethod: "transfer",
      userId,
    });

    await recordAudit({
      userId,
      userName: userName ?? "Sistema",
      action: "write_off",
      entityType: "loan",
      entityId: loanId,
      changes: {
        status: { old: "active", new: "defaulted" },
        writeOffAmount: { old: null, new: writtenOffAmount },
        reason: { old: null, new: reason },
      },
    });

    return { success: true, writeOffAmount: Number(writtenOffAmount) };
  });
};

// ---------------------------------------------------------------------------
// 7. cancelLoan — Cancelación solo si tiene 0 pagos
// ---------------------------------------------------------------------------

export const cancelLoan = async (loanId: string, userId: string) => {
  return await db.transaction(async (tx) => {
    const [loan] = await tx
      .select()
      .from(loans)
      .where(eq(loans.id, loanId))
      .limit(1);

    if (!loan) throw new Error("Préstamo no encontrado");
    if (loan.status !== "active") {
      throw new Error("Solo se pueden cancelar préstamos activos");
    }

    const payments = await tx
      .select({ count: sql<number>`COUNT(*)`.mapWith(Number) })
      .from(loanPayments)
      .where(eq(loanPayments.loanId, loanId));

    if ((payments[0]?.count ?? 0) > 0) {
      throw new Error(
        "No se puede cancelar un préstamo que ya cuenta con pagos registrados"
      );
    }

    await tx
      .update(loans)
      .set({ status: "cancelled" })
      .where(eq(loans.id, loanId));

    // Anular movimiento de desembolso
    await tx
      .update(cashMovements)
      .set({
        status: "voided",
        voidedAt: new Date(),
        voidedBy: userId,
        voidReason: "Cancelación de préstamo",
      })
      .where(
        and(
          eq(cashMovements.sourceId, loanId),
          eq(cashMovements.sourceType, "loan_disbursement"),
          eq(cashMovements.status, "posted")
        )
      );

    // Anular movimiento de comisión si existió
    await tx
      .update(cashMovements)
      .set({
        status: "voided",
        voidedAt: new Date(),
        voidedBy: userId,
        voidReason: "Cancelación de préstamo",
      })
      .where(
        and(
          eq(cashMovements.sourceId, loanId),
          eq(cashMovements.sourceType, "loan_origination_fee"),
          eq(cashMovements.status, "posted")
        )
      );

    await tx.delete(otherIncome).where(eq(otherIncome.loanId, loanId));

    return { success: true };
  });
};
