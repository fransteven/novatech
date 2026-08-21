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
  otherIncome,
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
import { resolveItemCost, type DbExecutor } from "./inventory-service";

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

type DbOrTx = typeof db | Parameters<typeof db.transaction>[0] extends (tx: infer T) => unknown ? T : never;

/**
 * Costo de una línea de apartado al liquidarla o cancelarla.
 *
 * Prefiere el snapshot congelado al apartar (layaway_details.unit_cost) para que
 * editar el inventario o mover el WAC no reescriba la utilidad de un trato ya
 * pactado. El fallback cubre los apartados abiertos antes de esa columna.
 */
export const resolveLayawayItemCost = async (
  item: {
    unitCost: string | null;
    productItemId: string | null;
    productId: string;
  },
  tx: DbExecutor,
): Promise<number> =>
  item.unitCost != null
    ? Number(item.unitCost)
    : await resolveItemCost(item.productItemId, item.productId, tx);

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
    // Costo real del ítem — sin esto la utilidad bruta de todo crédito
    // liquidado se reportaba al 100% (profits-service resta sale_details.unit_cost).
    const unitCost = await resolveLayawayItemCost(item, tx);

    await tx.insert(saleDetails).values({
      saleId: sale.id,
      productId: item.productId,
      productItemId: item.productItemId,
      price: item.agreedPrice,
      unitCost: toDbString(unitCost),
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
        unitCost: toDbString(unitCost),
        reason: `Venta por Crédito/Apartado Completado #${layawayId.slice(0, 8)}`,
      });
    } else {
      await tx.insert(inventoryMovements).values({
        productItemId: null,
        productId: item.productId,
        type: "OUT",
        quantity: item.quantity,
        unitCost: toDbString(unitCost),
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
      // Saldo pendiente de un crédito = cuotas no pagadas (capital + interés),
      // descontando abonos parciales ya aplicados a cada cuota.
      pendingSchedule: sql<number>`COALESCE((
        SELECT SUM(
          CAST(${layawaySchedule.totalAmount} AS DECIMAL)
          - CAST(${layawaySchedule.paidAmount} AS DECIMAL)
        )
        FROM ${layawaySchedule}
        WHERE ${layawaySchedule.layawayId} = ${layaways.id}
          AND ${layawaySchedule.status} <> 'pagada'
      ), 0)`.mapWith(Number),
      // Equipos del apartado (nombre + IMEI/serial) para mostrarlos en la lista
      // y poder filtrar por el código que salió a crédito. Va como subconsulta
      // correlacionada: un join a layaway_details multiplicaría filas e inflaría
      // el SUM de totalPaid.
      devices: sql<string>`COALESCE((
        SELECT string_agg(DISTINCT CONCAT_WS(' ',
          ${products.name},
          COALESCE(${productItems.serialNumber}, ${productItems.sku}, ${products.sku})
        ), ' | ')
        FROM ${layawayDetails}
        LEFT JOIN ${products} ON ${products.id} = ${layawayDetails.productId}
        LEFT JOIN ${productItems} ON ${productItems.id} = ${layawayDetails.productItemId}
        WHERE ${layawayDetails.layawayId} = ${layaways.id}
      ), '')`,
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

  return result.map((l) => {
    // En un apartado sin interés el precio pactado es todo lo que se debe, así
    // que el saldo sale de la caja recibida. En un crédito el cliente paga
    // capital + interés (más que totalAmount), por lo que restar los pagos del
    // precio da saldos negativos y marca el crédito como completado antes de
    // tiempo — el saldo real es lo que queda pendiente en el cronograma.
    const balance =
      l.type === "credito"
        ? l.pendingSchedule
        : Number(l.totalAmount) - l.totalPaid;

    return {
      ...l,
      totalAmount: Number(l.totalAmount),
      outstandingPrincipal: l.outstandingPrincipal ? Number(l.outstandingPrincipal) : null,
      installmentAmount: l.installmentAmount ? Number(l.installmentAmount) : null,
      balance,
    };
  });
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
      // Costo congelado al momento de apartar: si el inventario se edita o el WAC
      // se mueve durante la vida del apartado, la utilidad del trato no cambia.
      const itemCost = await resolveItemCost(
        item.productItemId || null,
        item.productId,
        tx,
      );

      if (item.price < itemCost) {
        throw new Error(
          `El precio de venta no puede ser menor al costo del producto. Costo: ${itemCost}`,
        );
      }

      await tx.insert(layawayDetails).values({
        layawayId: newLayaway.id,
        productId: item.productId,
        productItemId: item.productItemId || null,
        quantity: item.quantity,
        agreedPrice: item.price.toString(),
        unitCost: toDbString(itemCost),
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
  // Cabecera del layaway (precio de venta, financiamiento, fechas)
  const [layaway] = await db
    .select({
      id: layaways.id,
      type: layaways.type,
      status: layaways.status,
      totalAmount: layaways.totalAmount,
      financedCapital: layaways.financedCapital,
      outstandingPrincipal: layaways.outstandingPrincipal,
      interestRate: layaways.interestRate,
      termMonths: layaways.termMonths,
      installmentAmount: layaways.installmentAmount,
      createdAt: layaways.createdAt,
      expiresAt: layaways.expiresAt,
    })
    .from(layaways)
    .where(eq(layaways.id, layawayId))
    .limit(1);

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

  return { layaway: layaway ?? null, items: details, payments, schedule, riskHistory: risk };
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
    // Solo cambia con abono a capital (estrategia reduce_installment)
    let newInstallmentAmount: number | null = null;

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

      // La tasa es la pactada con este cliente (varía según su nivel de riesgo).
      // Regenerar con un default fijo cobraría un interés distinto al acordado.
      const monthlyRate = Number(lay.interestRate ?? 0);
      if (!(monthlyRate > 0)) {
        throw new Error(
          "El crédito no tiene una tasa de interés registrada; no se puede regenerar el cronograma"
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

    // 9. Actualizar saldo insoluto (y la cuota si el abono a capital la cambió)
    await tx
      .update(layaways)
      .set({
        outstandingPrincipal: toDbString(newOutstandingPrincipal),
        ...(newInstallmentAmount !== null
          ? { installmentAmount: toDbString(newInstallmentAmount) }
          : {}),
      })
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

export type CancelLayawayOptions = {
  /**
   * Solo créditos: si el equipo volvió físicamente a la tienda.
   * Obligatorio, porque en un crédito el equipo ya se entregó — devolverlo a
   * 'available' sin verificar crea stock fantasma (un equipo en manos del
   * cliente apareciendo como vendible).
   */
  deviceRecovered?: boolean;
  userId?: string | null;
};

export const cancelLayaway = async (
  layawayId: string,
  options: CancelLayawayOptions = {}
) => {
  return await db.transaction(async (tx) => {
    const [layaway] = await tx
      .select()
      .from(layaways)
      .where(eq(layaways.id, layawayId))
      .limit(1);

    if (!layaway || layaway.status !== "active")
      throw new Error("No se puede cancelar este apartado");

    assertTransition(layaway.status as LayawayStatus, "cancelled");

    const isCredit = layaway.type === "credito";

    if (isCredit && typeof options.deviceRecovered !== "boolean") {
      throw new Error(
        "Debes indicar si el equipo fue recuperado para cancelar un crédito"
      );
    }
    // En un apartado el equipo nunca salió de la tienda.
    const deviceRecovered = isCredit ? options.deviceRecovered! : true;

    // Plata que se queda en el negocio = todo lo cobrado menos el interés que
    // ya se reconoció como ingreso pago por pago (si no, se contaría dos veces).
    // Se calcula desde caja para que sirva igual en crédito y en apartado.
    const [collected] = await tx
      .select({
        total: sql<number>`COALESCE(SUM(CAST(${cashMovements.amount} AS DECIMAL)), 0)`.mapWith(
          Number
        ),
      })
      .from(cashMovements)
      .where(
        and(
          eq(cashMovements.sourceId, layawayId),
          sql`${cashMovements.sourceType} IN ('layaway_deposit', 'layaway_payment')`,
          eq(cashMovements.direction, "in"),
          eq(cashMovements.status, "posted")
        )
      );

    const [recognizedInterest] = await tx
      .select({
        total: sql<number>`COALESCE(SUM(CAST(${layawayPayments.interestPortion} AS DECIMAL)), 0)`.mapWith(
          Number
        ),
      })
      .from(layawayPayments)
      .where(eq(layawayPayments.layawayId, layawayId));

    const retainedCapital = Math.max(
      0,
      roundCOP(
        sub(collected?.total ?? 0, recognizedInterest?.total ?? 0)
      ).toNumber()
    );

    await tx
      .update(layaways)
      .set({ status: "cancelled" })
      .where(eq(layaways.id, layawayId));

    const details = await tx
      .select()
      .from(layawayDetails)
      .where(eq(layawayDetails.layawayId, layawayId));

    // Equipo no recuperado: económicamente es una venta al precio que se
    // alcanzó a cobrar. Se registra como tal para que el costo real del equipo
    // entre al reporte de ganancias (si el cobrado no cubre el costo, la
    // utilidad bruta del mes sale negativa, que es exactamente la pérdida).
    let saleId: string | null = null;
    if (!deviceRecovered) {
      const [sale] = await tx
        .insert(sales)
        .values({
          customerId: layaway.customerId,
          totalAmount: toDbString(retainedCapital),
          status: "completed",
        })
        .returning();
      saleId = sale.id;
    }

    // Con varios ítems, lo retenido se reparte a prorrata del precio pactado;
    // el último absorbe el residuo del redondeo para que sume exacto.
    const agreedTotal = details.reduce(
      (acc, d) => acc + Number(d.agreedPrice),
      0
    );
    let allocated = 0;

    for (const [index, item] of details.entries()) {
      const isLastItem = index === details.length - 1;
      const itemRevenue = isLastItem
        ? roundCOP(sub(retainedCapital, allocated)).toNumber()
        : roundCOP(
            money(retainedCapital)
              .times(Number(item.agreedPrice))
              .dividedBy(agreedTotal || 1)
          ).toNumber();
      allocated = roundCOP(money(allocated).plus(itemRevenue)).toNumber();

      const unitCost = await resolveLayawayItemCost(item, tx);

      if (deviceRecovered) {
        // Vuelve al inventario a su costo; no consume COGS.
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
            unitCost: toDbString(unitCost),
            reason: `Cancelación Apartado/Crédito #${layawayId.slice(0, 8)}`,
          });
        }
        continue;
      }

      // El equipo se queda con el cliente: sale definitivamente del stock.
      if (saleId) {
        await tx.insert(saleDetails).values({
          saleId,
          productId: item.productId,
          productItemId: item.productItemId,
          // El precio pactado nunca se cobró completo; el ingreso real es lo
          // que quedó en caja.
          price: toDbString(itemRevenue),
          unitCost: toDbString(unitCost),
        });
      }

      if (item.productItemId) {
        await tx
          .update(productItems)
          .set({ status: "lost" })
          .where(eq(productItems.id, item.productItemId));
        await tx.insert(inventoryMovements).values({
          productItemId: item.productItemId,
          productId: item.productId,
          type: "OUT",
          quantity: 1,
          unitCost: toDbString(unitCost),
          reason: `Crédito incumplido, equipo no recuperado #${layawayId.slice(0, 8)}`,
        });
      }
      // No serializado: el RESERVED_OUT del alta ya lo sacó del stock.
    }

    // Equipo recuperado y con plata cobrada: esa plata se queda en el negocio
    // sin costo asociado (el equipo sigue en inventario). Se reconoce como
    // ingreso del mes de la cancelación para que caja y utilidad cuadren.
    if (deviceRecovered && retainedCapital > 0) {
      await tx.insert(otherIncome).values({
        concept: "retencion_credito",
        amount: toDbString(retainedCapital),
        description: `Retención de capital por cancelación de ${
          isCredit ? "crédito" : "apartado"
        } #${layawayId.slice(0, 8)} (equipo recuperado)`,
        layawayId,
        createdBy: options.userId ?? null,
      });
    }

    return { success: true, retainedCapital, deviceRecovered };
  });
};
