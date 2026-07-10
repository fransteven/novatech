/**
 * layaway-service.ts — Lógica de negocio de Apartados y Créditos.
 *
 * Modalidades:
 *   sin_interes — apartado simple: abonos libres hasta saldar.
 *   credito     — crédito con tabla de amortización francesa, 5% mensual.
 */

import { db } from "@/db";
import {
  layaways,
  layawayDetails,
  layawaySchedule,
  layawayPayments,
  riskHistory,
  cashMovements,
  productItems,
  inventoryMovements,
  customers,
  products,
  sales,
  saleDetails,
} from "@/db/schema";
import { eq, desc, sql, and, asc } from "drizzle-orm";
import type {
  CreateLayawayInput,
  AddLayawayPaymentInput,
  RegisterCreditPaymentInput,
} from "@/lib/validators/layaway-validator";
import { generateSchedule } from "@/lib/credit/amortization";
import { applyCuota, applySoloInteres, applyAbonoCapital, applyAbonoCuota } from "@/lib/credit/payments";
import { computeRiskScore } from "@/lib/credit/risk";
import { DEFAULT_RISK_CONFIG } from "@/lib/credit/risk-config";
import { computeDpd } from "@/lib/credit/dpd";
import { assertTransition } from "@/lib/credit/state-machine";
import type { LayawayStatus } from "@/lib/credit/state-machine";
import { money, roundCOP, toDbString, sub } from "@/lib/money";
import { createNotification, detectUpcomingDue } from "./notification-service";

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

type DbOrTx = typeof db | Parameters<typeof db.transaction>[0] extends (tx: infer T) => unknown ? T : never;

/**
 * Recalcula el estado del crédito (DPD, mora, riesgo, notificaciones).
 * Se llama en cada pago y al leer la vista.
 */
async function recomputeCreditStatus(
  tx: typeof db,
  layawayId: string
): Promise<void> {
  // 1. Obtener cronograma
  const sched = await tx
    .select()
    .from(layawaySchedule)
    .where(eq(layawaySchedule.layawayId, layawayId))
    .orderBy(asc(layawaySchedule.number));

  if (sched.length === 0) return;

  const today = new Date();

  // 2. Marcar cuotas vencidas
  for (const entry of sched) {
    if (entry.status === "pendiente" && new Date(entry.dueDate) < today) {
      await tx
        .update(layawaySchedule)
        .set({ status: "vencida" })
        .where(eq(layawaySchedule.id, entry.id));
    }
  }

  // 3. Obtener layaway para score anterior y saldo
  const [lay] = await tx
    .select()
    .from(layaways)
    .where(eq(layaways.id, layawayId))
    .limit(1);
  if (!lay || lay.type !== "credito") return;

  // 4. Calcular DPD
  const schedEntries = sched.map((s) => ({
    number: s.number,
    dueDate: new Date(s.dueDate),
    status: s.status as "pendiente" | "pagada" | "vencida",
    principal: Number(s.principal),
    interest: Number(s.interest),
    totalAmount: Number(s.totalAmount),
    remainingBalance: Number(s.remainingBalance),
    paidAt: s.paidAt,
    paidAmount: Number(s.paidAmount ?? 0),
  }));
  const dpd = computeDpd(schedEntries, today);

  // 5. Contar atrasos históricos
  const lateInstallments = sched.filter(
    (s) => s.status === "pagada" && s.paidAt && new Date(s.paidAt) > new Date(s.dueDate)
  ).length;

  // 6. Contar pagos solo-interés
  const soloInteresRows = await tx
    .select({ count: sql<number>`COUNT(*)`.mapWith(Number) })
    .from(layawayPayments)
    .where(
      and(
        eq(layawayPayments.layawayId, layawayId),
        eq(layawayPayments.type, "solo_interes")
      )
    );
  const soloInteresCount = soloInteresRows[0]?.count ?? 0;

  // 7. Calcular consecutivos solo-interés recientes
  const recentPayments = await tx
    .select({ type: layawayPayments.type })
    .from(layawayPayments)
    .where(eq(layawayPayments.layawayId, layawayId))
    .orderBy(desc(layawayPayments.createdAt))
    .limit(10);

  let consecutiveSoloInteres = 0;
  for (const p of recentPayments) {
    if (p.type === "solo_interes") consecutiveSoloInteres++;
    else break;
  }

  // 8. Calcular % capital pagado
  const originalCapital = Number(lay.financedCapital ?? lay.totalAmount);
  const outstanding = Number(lay.outstandingPrincipal ?? lay.totalAmount);
  const pctPrincipalPaid =
    originalCapital > 0
      ? Math.round(((originalCapital - outstanding) / originalCapital) * 100)
      : 0;

  // 9. Score de riesgo
  const { score, level } = computeRiskScore(
    { dpd, lateInstallments, soloInteresCount, consecutiveSoloInteres, pctPrincipalPaid },
    DEFAULT_RISK_CONFIG
  );

  // 10. Determinar subStatus
  const newSubStatus = dpd > 0 ? "en_mora" : "al_dia";
  const previousScore = lay.riskScore ?? 0;
  const previousLevel = lay.riskLevel ?? "verde";
  const previousSubStatus = lay.subStatus;

  // 11. Persistir cambios en layaway
  await tx
    .update(layaways)
    .set({ riskScore: score, riskLevel: level, subStatus: newSubStatus })
    .where(eq(layaways.id, layawayId));

  // 12. Registrar en historial si el score cambió
  if (score !== previousScore) {
    await tx.insert(riskHistory).values({
      layawayId,
      previousScore,
      newScore: score,
      level,
      reason: `DPD=${dpd}, atrasos=${lateInstallments}, solo_interes=${soloInteresCount}, consecutivos=${consecutiveSoloInteres}, %capital=${pctPrincipalPaid}`,
    });
  }

  // 13. Notificaciones
  if (newSubStatus === "en_mora" && previousSubStatus !== "en_mora") {
    await createNotification({
      type: "mora",
      layawayId,
      title: "Cliente en mora",
      message: `Crédito con ${dpd} días de atraso.`,
      severity: "danger",
      dedupeKey: `mora:${layawayId}:${Math.floor(dpd / 7)}`,
    });
  }

  if (level === "rojo" && previousLevel !== "rojo") {
    await createNotification({
      type: "riesgo_rojo",
      layawayId,
      title: "Crédito en nivel Rojo",
      message: `Score de riesgo: ${score}. Requiere atención del equipo.`,
      severity: "danger",
      dedupeKey: `riesgo_rojo:${layawayId}:${score}`,
    });
  }
}

// ---------------------------------------------------------------------------
// Camino de completado (reutilizado de la lógica original)
// ---------------------------------------------------------------------------

async function completeLayaway(
  tx: typeof db,
  layawayId: string
): Promise<void> {
  const [lay] = await tx
    .select()
    .from(layaways)
    .where(eq(layaways.id, layawayId))
    .limit(1);
  if (!lay) return;

  await tx
    .update(layaways)
    .set({ status: "completed" })
    .where(eq(layaways.id, layawayId));

  const [sale] = await tx
    .insert(sales)
    .values({
      customerId: lay.customerId,
      totalAmount: lay.totalAmount,
      status: "completed",
    })
    .returning();

  const details = await tx
    .select()
    .from(layawayDetails)
    .where(eq(layawayDetails.layawayId, layawayId));

  for (const item of details) {
    await tx.insert(saleDetails).values({
      saleId: sale.id,
      productId: item.productId,
      productItemId: item.productItemId,
      price: item.agreedPrice,
      unitCost: "0", // TODO: traer costo real si se decide
    });

    if (item.productItemId) {
      await tx
        .update(productItems)
        .set({ status: "sold" })
        .where(eq(productItems.id, item.productItemId));
      await tx.insert(inventoryMovements).values({
        productItemId: item.productItemId,
        productId: item.productId,
        type: "OUT",
        quantity: 1,
        unitCost: "0",
        reason: `Venta por Crédito/Apartado Completado #${layawayId.slice(0, 8)}`,
      });
    } else {
      await tx.insert(inventoryMovements).values({
        productItemId: null,
        productId: item.productId,
        type: "OUT",
        quantity: item.quantity,
        reason: `Venta por Crédito/Apartado Completado #${layawayId.slice(0, 8)}`,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// getLayaways
// ---------------------------------------------------------------------------

export const getLayaways = async () => {
  // Detectar cuotas próximas a vencer y generar notificaciones
  await detectUpcomingDue().catch(() => {
    // No bloquear la carga si falla
  });

  const result = await db
    .select({
      id: layaways.id,
      type: layaways.type,
      status: layaways.status,
      subStatus: layaways.subStatus,
      totalAmount: layaways.totalAmount,
      expiresAt: layaways.expiresAt,
      createdAt: layaways.createdAt,
      termMonths: layaways.termMonths,
      installmentAmount: layaways.installmentAmount,
      outstandingPrincipal: layaways.outstandingPrincipal,
      riskScore: layaways.riskScore,
      riskLevel: layaways.riskLevel,
      customerName: customers.name,
      customerDocument: customers.documentId,
      customerPhone: customers.phone,
      totalPaid: sql<number>`COALESCE(SUM(CASE WHEN ${cashMovements.direction} = 'in' THEN CAST(${cashMovements.amount} AS DECIMAL) ELSE 0 END), 0)`.mapWith(Number),
    })
    .from(layaways)
    .leftJoin(customers, eq(layaways.customerId, customers.id))
    .leftJoin(
      cashMovements,
      sql`${cashMovements.sourceId} = ${layaways.id} AND ${cashMovements.sourceType} IN ('layaway_deposit', 'layaway_payment') AND ${cashMovements.status} = 'posted'`
    )
    .groupBy(
      layaways.id,
      customers.name,
      customers.documentId,
      customers.phone
    )
    .orderBy(desc(layaways.createdAt));

  return result.map((l) => ({
    ...l,
    totalAmount: Number(l.totalAmount),
    outstandingPrincipal: l.outstandingPrincipal ? Number(l.outstandingPrincipal) : null,
    installmentAmount: l.installmentAmount ? Number(l.installmentAmount) : null,
    balance: Number(l.totalAmount) - l.totalPaid,
  }));
};

// ---------------------------------------------------------------------------
// createLayaway
// ---------------------------------------------------------------------------

export const createLayaway = async (data: CreateLayawayInput) => {
  return await db.transaction(async (tx) => {
    const isCredit = data.type === "credito";
    const monthlyRate = data.interestRate ?? 0.05;

    // Capital financiado = totalAmount - cuota inicial (si aplica)
    const totalAmount = money(data.totalAmount);
    const initialDeposit = money(data.initialDeposit ?? 0);
    const financedCapital = isCredit
      ? roundCOP(totalAmount.minus(initialDeposit))
      : totalAmount;

    // Cuota fija francesa (solo crédito)
    let installmentAmount: number | undefined;
    if (isCredit) {
      const { generateSchedule: gen } = await import("@/lib/credit/amortization");
      const preview = gen({
        principal: financedCapital.toNumber(),
        monthlyRate,
        termMonths: data.termMonths!,
        startDate: new Date(),
      });
      installmentAmount = preview[0]?.totalAmount;
    }

    // 1. Crear cabecera
    const [newLayaway] = await tx
      .insert(layaways)
      .values({
        customerId: data.customerId,
        type: data.type ?? "sin_interes",
        status: "active",
        totalAmount: toDbString(totalAmount),
        expiresAt: data.expiresAt,
        interestRate: isCredit ? monthlyRate.toFixed(4) : null,
        financedCapital: isCredit ? toDbString(financedCapital) : null,
        outstandingPrincipal: isCredit ? toDbString(financedCapital) : null,
        termMonths: isCredit ? data.termMonths : null,
        installmentAmount: isCredit && installmentAmount ? toDbString(installmentAmount) : null,
        subStatus: isCredit ? "al_dia" : null,
        riskScore: 0,
        riskLevel: "verde",
      })
      .returning();

    // 2. Procesar ítems (inventario)
    for (const item of data.items) {
      await tx.insert(layawayDetails).values({
        layawayId: newLayaway.id,
        productId: item.productId,
        productItemId: item.productItemId || null,
        quantity: item.quantity,
        agreedPrice: item.price.toString(),
      });

      if (item.isSerialized && item.productItemId) {
        await tx
          .update(productItems)
          .set({ status: "reserved" })
          .where(eq(productItems.id, item.productItemId));
      } else if (!item.isSerialized) {
        await tx.insert(inventoryMovements).values({
          productId: item.productId,
          productItemId: null,
          type: "RESERVED_OUT",
          quantity: item.quantity,
          reason: `Apartado/Crédito #${newLayaway.id.slice(0, 8)}`,
        });
      }
    }

    // 3. Generar cronograma (solo crédito)
    if (isCredit && data.termMonths) {
      const schedule = generateSchedule({
        principal: financedCapital.toNumber(),
        monthlyRate,
        termMonths: data.termMonths,
        startDate: new Date(),
      });

      await tx.insert(layawaySchedule).values(
        schedule.map((entry) => ({
          layawayId: newLayaway.id,
          number: entry.number,
          dueDate: entry.dueDate,
          principal: toDbString(entry.principal),
          interest: toDbString(entry.interest),
          totalAmount: toDbString(entry.totalAmount),
          remainingBalance: toDbString(entry.remainingBalance),
          status: "pendiente",
        }))
      );
    }

    // 4. Abono inicial (si aplica)
    if (data.initialDeposit && data.initialDeposit > 0) {
      if (!data.accountId) throw new Error("Se requiere una cuenta para registrar el abono inicial");

      const [cm] = await tx
        .insert(cashMovements)
        .values({
          accountId: data.accountId,
          direction: "in",
          sourceType: isCredit ? "layaway_payment" : "layaway_deposit",
          sourceId: newLayaway.id,
          paymentMethod: data.paymentMethod,
          amount: toDbString(initialDeposit),
          referenceCode: data.referenceCode ?? null,
          notes: "Cuota inicial",
          createdBy: null,
          status: "posted",
        })
        .returning();

      if (isCredit) {
        await tx.insert(layawayPayments).values({
          layawayId: newLayaway.id,
          type: "abono_capital",
          amount: toDbString(initialDeposit),
          principalPortion: toDbString(initialDeposit),
          interestPortion: "0.00",
          cashMovementId: cm.id,
          idempotencyKey: `initial_${newLayaway.id}`,
          createdBy: null,
        });
      }
    }

    return newLayaway;
  });
};

// ---------------------------------------------------------------------------
// getLayawayDetails
// ---------------------------------------------------------------------------

export const getLayawayDetails = async (layawayId: string) => {
  const details = await db
    .select({
      id: layawayDetails.id,
      productId: products.id,
      productName: products.name,
      isSerialized: products.isSerialized,
      sku: products.sku,
      quantity: layawayDetails.quantity,
      agreedPrice: layawayDetails.agreedPrice,
      serialNumber: productItems.serialNumber,
    })
    .from(layawayDetails)
    .innerJoin(products, eq(layawayDetails.productId, products.id))
    .leftJoin(productItems, eq(layawayDetails.productItemId, productItems.id))
    .where(eq(layawayDetails.layawayId, layawayId));

  // Pagos (layawayPayments para crédito, cashMovements para sin_interes)
  const payments = await db
    .select({
      id: cashMovements.id,
      amount: cashMovements.amount,
      method: cashMovements.paymentMethod,
      createdAt: cashMovements.occurredAt,
      notes: cashMovements.notes,
    })
    .from(cashMovements)
    .where(
      and(
        eq(cashMovements.sourceId, layawayId),
        sql`${cashMovements.sourceType} IN ('layaway_deposit', 'layaway_payment')`,
        eq(cashMovements.status, "posted")
      )
    )
    .orderBy(desc(cashMovements.occurredAt));

  // Cronograma (si es crédito)
  const schedule = await db
    .select()
    .from(layawaySchedule)
    .where(eq(layawaySchedule.layawayId, layawayId))
    .orderBy(asc(layawaySchedule.number));

  // Historial de riesgo
  const risk = await db
    .select()
    .from(riskHistory)
    .where(eq(riskHistory.layawayId, layawayId))
    .orderBy(desc(riskHistory.occurredAt))
    .limit(20);

  return { items: details, payments, schedule, riskHistory: risk };
};

// ---------------------------------------------------------------------------
// addLayawayPayment (sin_interes — lógica original preservada)
// ---------------------------------------------------------------------------

export const addLayawayPayment = async (data: AddLayawayPaymentInput) => {
  return await db.transaction(async (tx) => {
    const [layaway] = await tx
      .select()
      .from(layaways)
      .where(eq(layaways.id, data.layawayId))
      .limit(1);

    if (!layaway) throw new Error("Apartado no encontrado");
    if (layaway.status !== "active")
      throw new Error(`El apartado no está activo (Estado actual: ${layaway.status})`);
    if (layaway.type !== "sin_interes")
      throw new Error("Usa registerCreditPaymentAction para créditos con interés");

    const paidQuery = await tx
      .select({
        total: sql<number>`COALESCE(SUM(CASE WHEN ${cashMovements.direction} = 'in' THEN CAST(${cashMovements.amount} AS DECIMAL) ELSE 0 END), 0)`.mapWith(Number),
      })
      .from(cashMovements)
      .where(
        and(
          eq(cashMovements.sourceId, layaway.id),
          eq(cashMovements.sourceType, "layaway_deposit"),
          eq(cashMovements.status, "posted")
        )
      );

    const totalPaid = paidQuery[0]?.total || 0;
    const totalAmount = Number(layaway.totalAmount);
    const balance = totalAmount - totalPaid;

    if (data.amount > balance) throw new Error("El abono supera el saldo pendiente");

    await tx.insert(cashMovements).values({
      accountId: data.accountId,
      direction: "in",
      sourceType: "layaway_deposit",
      sourceId: layaway.id,
      paymentMethod: data.paymentMethod,
      amount: data.amount.toString(),
      referenceCode: data.referenceCode ?? null,
      notes: data.notes ?? "Abono a apartado",
      createdBy: null,
      status: "posted",
    });

    if (totalPaid + data.amount >= totalAmount) {
      await completeLayaway(tx as unknown as typeof db, layaway.id);
    }

    return { success: true };
  });
};

// ---------------------------------------------------------------------------
// registerCreditPayment (credito — lógica nueva)
// ---------------------------------------------------------------------------

export const registerCreditPayment = async (data: RegisterCreditPaymentInput) => {
  return await db.transaction(async (tx) => {
    // 1. Cargar layaway
    const [lay] = await tx
      .select()
      .from(layaways)
      .where(eq(layaways.id, data.layawayId))
      .limit(1);

    if (!lay) throw new Error("Crédito no encontrado");
    if (lay.type !== "credito") throw new Error("Este apartado no es un crédito con interés");

    // 2. Validar que el crédito esté activo
    if (lay.status !== "active") {
      throw new Error(`El crédito no está activo (Estado: ${lay.status})`);
    }

    // 3. Idempotencia
    const existing = await tx
      .select({ id: layawayPayments.id })
      .from(layawayPayments)
      .where(eq(layawayPayments.idempotencyKey, data.idempotencyKey))
      .limit(1);
    if (existing.length > 0) {
      return { success: true, duplicate: true };
    }

    // 4. Cargar cronograma
    const sched = await tx
      .select()
      .from(layawaySchedule)
      .where(eq(layawaySchedule.layawayId, data.layawayId))
      .orderBy(asc(layawaySchedule.number));

    const schedEntries = sched.map((s) => ({
      number: s.number,
      dueDate: new Date(s.dueDate),
      status: s.status as "pendiente" | "pagada" | "vencida",
      principal: Number(s.principal),
      interest: Number(s.interest),
      totalAmount: Number(s.totalAmount),
      remainingBalance: Number(s.remainingBalance),
      paidAt: s.paidAt,
      paidAmount: Number(s.paidAmount ?? 0),
    }));

    let principalPortion = 0;
    let interestPortion = 0;
    let newScheduleEntries = schedEntries;
    let newOutstandingPrincipal = Number(lay.outstandingPrincipal ?? lay.totalAmount);

    // 5. Aplicar tipo de pago
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
      // El cronograma NO avanza — newScheduleEntries permanece igual
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
      if (!data.capitalStrategy) throw new Error("Se requiere la estrategia de abono a capital");
      const result = applyAbonoCapital(
        { schedule: schedEntries, outstandingPrincipal: newOutstandingPrincipal },
        data.amount,
        data.capitalStrategy,
        0.05,
        new Date()
      );
      principalPortion = data.amount;
      newScheduleEntries = result.newSchedule;
      newOutstandingPrincipal = result.newOutstandingPrincipal;
    }

    // 6. Registrar cashMovement
    const [cm] = await tx
      .insert(cashMovements)
      .values({
        accountId: data.accountId,
        direction: "in",
        sourceType: "layaway_payment",
        sourceId: data.layawayId,
        paymentMethod: data.paymentMethod,
        amount: toDbString(data.amount),
        referenceCode: data.referenceCode ?? null,
        notes: data.notes ?? `Pago ${data.type}`,
        createdBy: data.userId ?? null,
        status: "posted",
      })
      .returning();

    // 7. Registrar en layawayPayments
    await tx.insert(layawayPayments).values({
      layawayId: data.layawayId,
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

    // 8. Persistir cronograma actualizado
    if (data.type === "cuota") {
      // Solo actualizar la cuota pagada
      const paid = newScheduleEntries.find((e) => e.number === data.scheduleNumber);
      if (paid) {
        await tx
          .update(layawaySchedule)
          .set({ status: "pagada", paidAt: paid.paidAt ?? new Date() })
          .where(
            and(
              eq(layawaySchedule.layawayId, data.layawayId),
              eq(layawaySchedule.number, paid.number)
            )
          );
      }
    } else if (data.type === "abono_cuota") {
      // Actualiza el acumulado de la cuota; solo marca 'pagada' si se completó
      const updated = newScheduleEntries.find((e) => e.number === data.scheduleNumber);
      if (updated) {
        await tx
          .update(layawaySchedule)
          .set({
            paidAmount: toDbString(updated.paidAmount),
            status: updated.status,
            paidAt: updated.paidAt,
          })
          .where(
            and(
              eq(layawaySchedule.layawayId, data.layawayId),
              eq(layawaySchedule.number, updated.number)
            )
          );
      }
    } else if (data.type === "abono_capital") {
      // Regenerar todo el cronograma
      await tx
        .delete(layawaySchedule)
        .where(eq(layawaySchedule.layawayId, data.layawayId));
      await tx.insert(layawaySchedule).values(
        newScheduleEntries.map((e) => ({
          layawayId: data.layawayId,
          number: e.number,
          dueDate: e.dueDate,
          principal: toDbString(e.principal),
          interest: toDbString(e.interest),
          totalAmount: toDbString(e.totalAmount),
          remainingBalance: toDbString(e.remainingBalance),
          status: e.status,
          paidAt: e.paidAt,
        }))
      );
    }

    // 9. Actualizar saldo insoluto
    await tx
      .update(layaways)
      .set({ outstandingPrincipal: toDbString(newOutstandingPrincipal) })
      .where(eq(layaways.id, data.layawayId));

    // 10. ¿Crédito completamente saldado?
    const allPaid = newScheduleEntries.every((e) => e.status === "pagada");
    if (allPaid || newOutstandingPrincipal <= 0) {
      await completeLayaway(tx as unknown as typeof db, data.layawayId);
    } else {
      // 11. Recalcular estado de riesgo
      await recomputeCreditStatus(tx as unknown as typeof db, data.layawayId);
    }

    return { success: true, duplicate: false };
  });
};

// ---------------------------------------------------------------------------
// cancelLayaway
// ---------------------------------------------------------------------------

export const cancelLayaway = async (layawayId: string) => {
  return await db.transaction(async (tx) => {
    const [layaway] = await tx
      .select()
      .from(layaways)
      .where(eq(layaways.id, layawayId))
      .limit(1);

    if (!layaway || layaway.status !== "active")
      throw new Error("No se puede cancelar este apartado");

    assertTransition(layaway.status as LayawayStatus, "cancelled");

    await tx
      .update(layaways)
      .set({ status: "cancelled" })
      .where(eq(layaways.id, layawayId));

    const details = await tx
      .select()
      .from(layawayDetails)
      .where(eq(layawayDetails.layawayId, layawayId));

    for (const item of details) {
      if (item.productItemId) {
        await tx
          .update(productItems)
          .set({ status: "available" })
          .where(eq(productItems.id, item.productItemId));
      } else {
        await tx.insert(inventoryMovements).values({
          productId: item.productId,
          type: "RESERVED_IN",
          quantity: item.quantity,
          reason: `Cancelación Apartado/Crédito #${layawayId.slice(0, 8)}`,
        });
      }
    }

    return { success: true };
  });
};
