import { db } from "@/db";
import {
  purchases,
  purchaseDetails,
  purchaseExtraCosts,
  purchasePayments,
  productItems,
  cashAccounts,
  products,
  providers,
} from "@/db/schema";
import { eq, desc, sql, and, gte, lte, ilike, or } from "drizzle-orm";
import { createCashMovement } from "@/services/cash-service";
import {
  receiveStockLines,
  type DbExecutor,
  type ReceiveStockLine,
} from "@/services/inventory-service";
import { allocateExtraCosts, derivePaymentStatus } from "@/lib/purchase-costs";

export interface PurchaseDetailInput {
  productId: string;
  quantity: number;
  unitCost: number;
  /** Sólo para productos serializados; el servidor decide si aplican. */
  serialNumbers?: string[];
  conditionDetails?: { batteryHealth?: number } | null;
  notes?: string;
}

export interface PurchaseExtraCostInput {
  concept: string;
  amount: number;
  notes?: string;
}

export interface CreatePurchaseInput {
  /** UUID por intento de registro: evita duplicar la compra ante un doble submit. */
  idempotencyKey: string;
  providerId: string;
  purchaseDate?: Date;
  invoiceNumber?: string;
  notes?: string;
  details: PurchaseDetailInput[];
  extraCosts?: PurchaseExtraCostInput[];
  /** Monto pagado al proveedor en este momento. 0 = compra a crédito. */
  amountPaid: number;
  accountId?: string | null;
  paymentMethod: string;
  referenceCode?: string;
  /** Total calculado por el cliente; sólo sirve para detectar desincronización. */
  expectedTotal?: number;
  userId: string;
}

export interface RegisterPurchasePaymentInput {
  purchaseId: string;
  amount: number;
  accountId: string;
  paymentMethod: string;
  referenceCode?: string;
  notes?: string;
  idempotencyKey: string;
  userId: string;
}

export interface PurchaseFilters {
  providerId?: string;
  paymentStatus?: string;
  from?: Date;
  to?: Date;
  search?: string;
}

type PurchaseDetailRow = typeof purchaseDetails.$inferInsert;

/** Tolerancia al comparar el total del cliente contra el recalculado (1 peso). */
const TOTAL_MISMATCH_TOLERANCE = 1;

const round2 = (value: number): number => Number(value.toFixed(2));

/**
 * Verifica que la cuenta de caja exista y esté activa antes de moverle plata.
 */
const assertActiveAccount = async (tx: DbExecutor, accountId: string) => {
  const [account] = await tx
    .select({ id: cashAccounts.id, isActive: cashAccounts.isActive })
    .from(cashAccounts)
    .where(eq(cashAccounts.id, accountId))
    .limit(1);

  if (!account) {
    throw new Error("La cuenta de caja seleccionada no existe.");
  }
  if (!account.isActive) {
    throw new Error("La cuenta de caja seleccionada está inactiva.");
  }
};

/**
 * Registra el abono en caja y en el libro de pagos de la compra.
 * Devuelve el id del movimiento de caja creado.
 */
const postPurchasePayment = async (
  tx: DbExecutor,
  input: {
    purchaseId: string;
    amount: number;
    accountId: string;
    paymentMethod: string;
    referenceCode?: string;
    notes?: string;
    idempotencyKey: string;
    userId: string;
    occurredAt: Date;
  },
) => {
  const movement = await createCashMovement(
    {
      accountId: input.accountId,
      direction: "out",
      amount: input.amount,
      sourceType: "purchase_payment",
      sourceId: input.purchaseId,
      paymentMethod: input.paymentMethod,
      referenceCode: input.referenceCode,
      notes: input.notes,
      createdBy: input.userId,
      occurredAt: input.occurredAt,
    },
    tx,
  );

  await tx.insert(purchasePayments).values({
    purchaseId: input.purchaseId,
    amount: input.amount.toString(),
    accountId: input.accountId,
    paymentMethod: input.paymentMethod,
    referenceCode: input.referenceCode,
    cashMovementId: movement.id,
    idempotencyKey: input.idempotencyKey,
    notes: input.notes,
    userId: input.userId,
    occurredAt: input.occurredAt,
  });

  return movement.id;
};

export const PurchaseService = {
  /**
   * Registra una compra completa en UNA sola transacción:
   *
   *   purchases → purchase_extra_costs → product_items → inventory_movements
   *   → purchase_details → cash_movements → purchase_payments
   *
   * Reglas que el servidor no delega al cliente:
   * - `isSerialized` sale del catálogo (`receiveStockLines`), no del payload.
   * - Subtotal, costos adicionales y total se recalculan aquí.
   * - Los costos adicionales se prorratean al costo unitario aterrizado, que es
   *   el que se guarda en inventario y el que `resolveItemCost` usa al vender.
   * - El estado de pago se deriva de lo abonado; sin abono no se toca caja.
   */
  async createPurchase(input: CreatePurchaseInput) {
    if (input.details.length === 0) {
      throw new Error("La compra debe tener al menos un producto.");
    }

    // Idempotencia: un segundo submit con la misma llave devuelve la compra ya creada.
    const [existing] = await db
      .select()
      .from(purchases)
      .where(eq(purchases.idempotencyKey, input.idempotencyKey))
      .limit(1);

    if (existing) return existing;

    const purchaseDate = input.purchaseDate ?? new Date();
    const extraCosts = (input.extraCosts ?? []).filter(
      (cost) => Number(cost.amount) > 0,
    );
    const extraCostsAmount = round2(
      extraCosts.reduce((acc, cost) => acc + Number(cost.amount), 0),
    );

    // Totales y costo aterrizado — calculados en el servidor, siempre.
    const allocation = allocateExtraCosts(
      input.details.map((detail) => ({
        quantity: detail.quantity,
        unitCost: detail.unitCost,
      })),
      extraCostsAmount,
    );

    if (
      input.expectedTotal !== undefined &&
      Math.abs(input.expectedTotal - allocation.total) >
        TOTAL_MISMATCH_TOLERANCE
    ) {
      throw new Error(
        `El total enviado ($${input.expectedTotal.toLocaleString("es-CO")}) no coincide con el calculado ($${allocation.total.toLocaleString("es-CO")}). Recarga el formulario e intenta de nuevo.`,
      );
    }

    const amountPaid = round2(Math.max(0, input.amountPaid));
    if (amountPaid > allocation.total + TOTAL_MISMATCH_TOLERANCE) {
      throw new Error(
        "El monto pagado no puede superar el total de la compra.",
      );
    }
    if (amountPaid > 0 && !input.accountId) {
      throw new Error("Selecciona la cuenta de caja de la que sale el pago.");
    }

    const paymentStatus = derivePaymentStatus(amountPaid, allocation.total);

    return await db.transaction(async (tx) => {
      // 1. Proveedor y cuenta
      const [provider] = await tx
        .select({ id: providers.id })
        .from(providers)
        .where(eq(providers.id, input.providerId))
        .limit(1);

      if (!provider) {
        throw new Error("El proveedor seleccionado no existe.");
      }

      if (amountPaid > 0 && input.accountId) {
        await assertActiveAccount(tx, input.accountId);
      }

      // 2. Cabecera
      const [purchase] = await tx
        .insert(purchases)
        .values({
          providerId: input.providerId,
          purchaseDate,
          invoiceNumber: input.invoiceNumber,
          accountId: amountPaid > 0 ? input.accountId : null,
          paymentMethod: input.paymentMethod,
          referenceCode: input.referenceCode,
          subtotalAmount: allocation.subtotal.toString(),
          extraCostsAmount: allocation.extraCostsAmount.toString(),
          totalAmount: allocation.total.toString(),
          paymentStatus,
          amountPaid: amountPaid.toString(),
          idempotencyKey: input.idempotencyKey,
          notes: input.notes,
          userId: input.userId,
        })
        .returning();

      // 3. Costos adicionales
      if (extraCosts.length > 0) {
        await tx.insert(purchaseExtraCosts).values(
          extraCosts.map((cost) => ({
            purchaseId: purchase.id,
            concept: cost.concept,
            amount: round2(Number(cost.amount)).toString(),
            notes: cost.notes,
          })),
        );
      }

      // 4. Inventario — mismas reglas que el ingreso manual de stock
      const reason = `Compra #${purchase.id.slice(0, 8)}`;
      const stockLines: ReceiveStockLine[] = input.details.map(
        (detail, index) => ({
          productId: detail.productId,
          quantity: detail.quantity,
          unitCost: allocation.lines[index].landedUnitCost,
          unitCosts: allocation.lines[index].landedUnitCosts,
          serials: detail.serialNumbers,
          conditionDetails: detail.conditionDetails ?? null,
          notes: detail.notes ?? null,
          reason,
        }),
      );

      const received = await receiveStockLines(tx, stockLines);

      // 5. Detalle de la compra (una fila por serial; una por línea genérica)
      const detailRows: PurchaseDetailRow[] =
        input.details.flatMap<PurchaseDetailRow>((detail, index) => {
          const line = allocation.lines[index];
          const receivedLine = received[index];

          if (receivedLine.isSerialized) {
            return receivedLine.items.map((item, unitIndex) => ({
              purchaseId: purchase.id,
              productId: detail.productId,
              productItemId: item.id,
              quantity: 1,
              unitCost: detail.unitCost.toString(),
              landedUnitCost: (
                line.landedUnitCosts[unitIndex] ?? line.landedUnitCost
              ).toString(),
              lineTotal: detail.unitCost.toString(),
              serialNumber: item.serialNumber,
              conditionDetails: detail.conditionDetails ?? null,
              notes: detail.notes,
            }));
          }

          return [
            {
              purchaseId: purchase.id,
              productId: detail.productId,
              productItemId: null,
              quantity: detail.quantity,
              unitCost: detail.unitCost.toString(),
              landedUnitCost: line.landedUnitCost.toString(),
              lineTotal: line.lineTotal.toString(),
              serialNumber: null,
              conditionDetails: null,
              notes: detail.notes,
            },
          ];
        });

      await tx.insert(purchaseDetails).values(detailRows);

      // 6. Pago: sólo si efectivamente se abonó algo
      if (amountPaid > 0 && input.accountId) {
        await postPurchasePayment(tx, {
          purchaseId: purchase.id,
          amount: amountPaid,
          accountId: input.accountId,
          paymentMethod: input.paymentMethod,
          referenceCode: input.referenceCode,
          notes: `Pago de compra #${purchase.id.slice(0, 8)}`,
          idempotencyKey: `${input.idempotencyKey}:initial`,
          userId: input.userId,
          occurredAt: purchaseDate,
        });
      }

      return purchase;
    });
  },

  /**
   * Abono posterior a una compra a crédito. Mueve caja y recalcula el estado
   * de pago a partir de la suma real de abonos.
   */
  async registerPurchasePayment(input: RegisterPurchasePaymentInput) {
    if (input.amount <= 0) {
      throw new Error("El monto del abono debe ser mayor a 0.");
    }

    const [existing] = await db
      .select()
      .from(purchasePayments)
      .where(eq(purchasePayments.idempotencyKey, input.idempotencyKey))
      .limit(1);

    if (existing) return existing;

    return await db.transaction(async (tx) => {
      const [purchase] = await tx
        .select()
        .from(purchases)
        .where(eq(purchases.id, input.purchaseId))
        .limit(1);

      if (!purchase) {
        throw new Error("La compra no existe.");
      }
      if (purchase.status === "voided") {
        throw new Error("La compra está anulada.");
      }

      const total = Number(purchase.totalAmount);
      const alreadyPaid = Number(purchase.amountPaid);
      const pending = round2(total - alreadyPaid);

      if (pending <= 0) {
        throw new Error("Esta compra ya está pagada por completo.");
      }

      const amount = round2(input.amount);
      if (amount > pending + TOTAL_MISMATCH_TOLERANCE) {
        throw new Error(
          `El abono supera el saldo pendiente ($${pending.toLocaleString("es-CO")}).`,
        );
      }

      await assertActiveAccount(tx, input.accountId);

      const occurredAt = new Date();
      await postPurchasePayment(tx, {
        purchaseId: purchase.id,
        amount,
        accountId: input.accountId,
        paymentMethod: input.paymentMethod,
        referenceCode: input.referenceCode,
        notes: input.notes ?? `Abono a compra #${purchase.id.slice(0, 8)}`,
        idempotencyKey: input.idempotencyKey,
        userId: input.userId,
        occurredAt,
      });

      // El acumulado se recalcula desde el libro de abonos, no incrementando en memoria.
      const [totals] = await tx
        .select({
          paid: sql<number>`COALESCE(SUM(${purchasePayments.amount}::numeric), 0)`.mapWith(
            Number,
          ),
        })
        .from(purchasePayments)
        .where(eq(purchasePayments.purchaseId, purchase.id));

      const newAmountPaid = round2(totals?.paid ?? 0);

      const [updated] = await tx
        .update(purchases)
        .set({
          amountPaid: newAmountPaid.toString(),
          paymentStatus: derivePaymentStatus(newAmountPaid, total),
          updatedAt: new Date(),
        })
        .where(eq(purchases.id, purchase.id))
        .returning();

      return updated;
    });
  },

  async getPurchases(filters: PurchaseFilters = {}) {
    const conditions = [];

    if (filters.providerId) {
      conditions.push(eq(purchases.providerId, filters.providerId));
    }
    if (filters.paymentStatus) {
      conditions.push(eq(purchases.paymentStatus, filters.paymentStatus));
    }
    if (filters.from) {
      conditions.push(gte(purchases.purchaseDate, filters.from));
    }
    if (filters.to) {
      conditions.push(lte(purchases.purchaseDate, filters.to));
    }
    if (filters.search) {
      const term = `%${filters.search.trim()}%`;
      conditions.push(
        or(
          ilike(purchases.invoiceNumber, term),
          ilike(purchases.referenceCode, term),
          ilike(providers.name, term),
        ),
      );
    }

    const data = await db
      .select({
        purchase: purchases,
        provider: providers,
        itemCount: sql<number>`(
          SELECT COALESCE(SUM(${purchaseDetails.quantity}), 0)
          FROM ${purchaseDetails}
          WHERE ${purchaseDetails.purchaseId} = ${purchases.id}
        )`.mapWith(Number),
      })
      .from(purchases)
      .leftJoin(providers, eq(purchases.providerId, providers.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(purchases.purchaseDate));

    return data.map((row) => ({
      ...row.purchase,
      provider: row.provider,
      itemCount: row.itemCount,
      pendingAmount: round2(
        Number(row.purchase.totalAmount) - Number(row.purchase.amountPaid),
      ),
    }));
  },

  async getPurchaseById(id: string) {
    const [purchaseData] = await db
      .select({
        purchase: purchases,
        provider: providers,
      })
      .from(purchases)
      .leftJoin(providers, eq(purchases.providerId, providers.id))
      .where(eq(purchases.id, id));

    if (!purchaseData) return null;

    const [details, extraCosts, payments] = await Promise.all([
      db
        .select({
          detail: purchaseDetails,
          product: products,
          itemSerial: productItems.serialNumber,
        })
        .from(purchaseDetails)
        .leftJoin(products, eq(purchaseDetails.productId, products.id))
        .leftJoin(
          productItems,
          eq(purchaseDetails.productItemId, productItems.id),
        )
        .where(eq(purchaseDetails.purchaseId, id)),
      db
        .select()
        .from(purchaseExtraCosts)
        .where(eq(purchaseExtraCosts.purchaseId, id)),
      db
        .select({
          payment: purchasePayments,
          accountName: cashAccounts.name,
        })
        .from(purchasePayments)
        .leftJoin(cashAccounts, eq(purchasePayments.accountId, cashAccounts.id))
        .where(eq(purchasePayments.purchaseId, id))
        .orderBy(desc(purchasePayments.occurredAt)),
    ]);

    return {
      ...purchaseData.purchase,
      provider: purchaseData.provider,
      pendingAmount: round2(
        Number(purchaseData.purchase.totalAmount) -
          Number(purchaseData.purchase.amountPaid),
      ),
      details: details.map((row) => ({
        ...row.detail,
        product: row.product,
        serialNumber: row.detail.serialNumber ?? row.itemSerial,
      })),
      extraCosts,
      payments: payments.map((row) => ({
        ...row.payment,
        accountName: row.accountName,
      })),
    };
  },

  async getPurchaseStats() {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [totals] = await db
      .select({
        totalAmount:
          sql<number>`COALESCE(SUM(${purchases.totalAmount}::numeric), 0)`.mapWith(
            Number,
          ),
        count: sql<number>`COUNT(${purchases.id})`.mapWith(Number),
        pendingAmount:
          sql<number>`COALESCE(SUM(${purchases.totalAmount}::numeric - ${purchases.amountPaid}::numeric), 0)`.mapWith(
            Number,
          ),
        pendingCount:
          sql<number>`COUNT(*) FILTER (WHERE ${purchases.paymentStatus} <> 'paid')`.mapWith(
            Number,
          ),
      })
      .from(purchases)
      .where(eq(purchases.status, "posted"));

    const [month] = await db
      .select({
        totalAmount:
          sql<number>`COALESCE(SUM(${purchases.totalAmount}::numeric), 0)`.mapWith(
            Number,
          ),
        count: sql<number>`COUNT(${purchases.id})`.mapWith(Number),
      })
      .from(purchases)
      .where(
        and(
          eq(purchases.status, "posted"),
          gte(purchases.purchaseDate, monthStart),
        ),
      );

    return {
      totalAmount: totals?.totalAmount ?? 0,
      count: totals?.count ?? 0,
      pendingAmount: round2(totals?.pendingAmount ?? 0),
      pendingCount: totals?.pendingCount ?? 0,
      monthAmount: month?.totalAmount ?? 0,
      monthCount: month?.count ?? 0,
    };
  },
};
