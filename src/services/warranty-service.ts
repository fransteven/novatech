import { db } from "@/db";
import {
  products,
  productItems,
  sales,
  saleDetails,
  layaways,
  layawayDetails,
  customers,
  warranties,
  warrantyClaims,
} from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import {
  AdjustWarrantyInput,
  CreateClaimInput,
  UpdateClaimStatusInput,
} from "@/lib/validators/warranty-validator";
import { computeWarrantyExpiry, DEFAULT_WARRANTY_MONTHS } from "@/lib/warranty/warranty-calc";

export { DEFAULT_WARRANTY_MONTHS };

type WarrantySource = {
  sourceType: "sale" | "layaway";
  sourceId: string;
  customerId: string | null;
  startDate: Date;
};

/**
 * Busca de dónde salió esta unidad (venta directa o apartado/crédito) para
 * derivar la fecha de entrega cuando aún no hay una garantía materializada.
 * Prioriza la venta directa; si no existe, revisa apartados/créditos, donde
 * el equipo suele entregarse al inicio del contrato, no al liquidar.
 */
const findWarrantySource = async (
  productItemId: string,
): Promise<WarrantySource | null> => {
  const [saleRow] = await db
    .select({
      saleId: sales.id,
      customerId: sales.customerId,
      createdAt: sales.createdAt,
    })
    .from(saleDetails)
    .innerJoin(sales, eq(saleDetails.saleId, sales.id))
    .where(eq(saleDetails.productItemId, productItemId))
    .orderBy(desc(sales.createdAt))
    .limit(1);

  if (saleRow) {
    return {
      sourceType: "sale",
      sourceId: saleRow.saleId,
      customerId: saleRow.customerId,
      startDate: saleRow.createdAt,
    };
  }

  const [layawayRow] = await db
    .select({
      layawayId: layaways.id,
      customerId: layaways.customerId,
      createdAt: layaways.createdAt,
    })
    .from(layawayDetails)
    .innerJoin(layaways, eq(layawayDetails.layawayId, layaways.id))
    .where(eq(layawayDetails.productItemId, productItemId))
    .orderBy(desc(layaways.createdAt))
    .limit(1);

  if (layawayRow) {
    return {
      sourceType: "layaway",
      sourceId: layawayRow.layawayId,
      customerId: layawayRow.customerId,
      startDate: layawayRow.createdAt,
    };
  }

  return null;
};

const getClaimsForWarranty = async (warrantyId: string) => {
  return await db
    .select()
    .from(warrantyClaims)
    .where(eq(warrantyClaims.warrantyId, warrantyId))
    .orderBy(desc(warrantyClaims.reportedAt));
};

/**
 * Resuelve el estado de garantía de una unidad puntual: usa la fila
 * materializada en `warranties` si existe (fuente autoritativa, con fecha de
 * entrega editable); si no, la deriva al vuelo desde la venta/apartado de
 * origen (`isProvisional: true`).
 */
const resolveWarranty = async (productItem: {
  id: string;
  productId: string;
  status: string;
}) => {
  const product = await db.query.products.findFirst({
    where: eq(products.id, productItem.productId),
  });
  if (!product) return null;

  const [materialized] = await db
    .select()
    .from(warranties)
    .where(eq(warranties.productItemId, productItem.id))
    .limit(1);

  if (materialized) {
    const { expiryDate, status, daysRemaining } = computeWarrantyExpiry(
      materialized.startDate,
      materialized.warrantyMonths,
    );
    const customer = materialized.customerId
      ? await db.query.customers.findFirst({
          where: eq(customers.id, materialized.customerId),
        })
      : null;
    const claims = await getClaimsForWarranty(materialized.id);

    return {
      delivered: true,
      isProvisional: false,
      warrantyId: materialized.id,
      product,
      customer,
      sourceType: materialized.sourceType,
      sourceId: materialized.sourceId,
      startDate: materialized.startDate,
      warrantyMonths: materialized.warrantyMonths,
      expiryDate,
      status,
      daysRemaining,
      claims,
    };
  }

  const source = await findWarrantySource(productItem.id);
  if (!source) {
    // La unidad existe en inventario pero no hay registro de venta/entrega.
    return {
      delivered: false,
      isProvisional: true,
      warrantyId: null,
      product,
      customer: null,
      sourceType: null,
      sourceId: null,
      startDate: null,
      warrantyMonths: product.warrantyMonths ?? DEFAULT_WARRANTY_MONTHS,
      expiryDate: null,
      status: null,
      daysRemaining: null,
      claims: [],
    };
  }

  const warrantyMonths = product.warrantyMonths ?? DEFAULT_WARRANTY_MONTHS;
  const { expiryDate, status, daysRemaining } = computeWarrantyExpiry(
    source.startDate,
    warrantyMonths,
  );
  const customer = source.customerId
    ? await db.query.customers.findFirst({
        where: eq(customers.id, source.customerId),
      })
    : null;

  return {
    delivered: true,
    isProvisional: true,
    warrantyId: null,
    product,
    customer,
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    startDate: source.startDate,
    warrantyMonths,
    expiryDate,
    status,
    daysRemaining,
    claims: [],
  };
};

export const getWarrantyBySerial = async (serial: string) => {
  const cleanSerial = serial.trim();

  const [productItem] = await db
    .select({
      id: productItems.id,
      productId: productItems.productId,
      status: productItems.status,
      serialNumber: productItems.serialNumber,
    })
    .from(productItems)
    .where(
      sql`LOWER(TRIM(${productItems.serialNumber})) = LOWER(${cleanSerial})`,
    )
    .limit(1);

  if (!productItem) {
    return { found: false as const };
  }

  const resolved = await resolveWarranty(productItem);
  if (!resolved) {
    return { found: false as const };
  }

  return {
    found: true as const,
    productItem,
    ...resolved,
  };
};

/**
 * Persiste la garantía derivada (o la crea manualmente) para que quede como
 * fuente autoritativa — se dispara al registrar el primer reclamo de una
 * unidad, o al ajustar manualmente la fecha de entrega.
 */
export const materializeWarranty = async (input: {
  productItemId: string;
  customerId: string | null;
  sourceType: "sale" | "layaway" | "manual";
  sourceId: string | null;
  warrantyMonths: number;
  startDate: Date;
  notes?: string;
  createdBy?: string;
}) => {
  const [existing] = await db
    .select()
    .from(warranties)
    .where(eq(warranties.productItemId, input.productItemId))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(warranties)
    .values({
      productItemId: input.productItemId,
      customerId: input.customerId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      warrantyMonths: input.warrantyMonths,
      startDate: input.startDate,
      notes: input.notes ?? null,
      createdBy: input.createdBy ?? null,
    })
    .returning();

  return created;
};

/**
 * Ajuste administrativo: corrige la fecha real de entrega y/o los meses de
 * garantía de una unidad. Necesario porque en apartados/créditos el equipo a
 * veces se entrega antes de que el sistema tenga otra señal de "entrega".
 */
export const adjustWarranty = async (
  input: AdjustWarrantyInput,
  adminId: string,
) => {
  const [productItem] = await db
    .select({
      id: productItems.id,
      productId: productItems.productId,
      status: productItems.status,
    })
    .from(productItems)
    .where(eq(productItems.id, input.productItemId))
    .limit(1);

  if (!productItem) {
    throw new Error("Unidad de inventario no encontrada");
  }

  const [existing] = await db
    .select()
    .from(warranties)
    .where(eq(warranties.productItemId, input.productItemId))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(warranties)
      .set({
        startDate: input.startDate,
        warrantyMonths: input.warrantyMonths,
        notes: input.notes ?? existing.notes,
      })
      .where(eq(warranties.id, existing.id))
      .returning();
    return { warranty: updated, previous: existing };
  }

  const source = await findWarrantySource(input.productItemId);
  const created = await materializeWarranty({
    productItemId: input.productItemId,
    customerId: source?.customerId ?? null,
    sourceType: source?.sourceType ?? "manual",
    sourceId: source?.sourceId ?? null,
    warrantyMonths: input.warrantyMonths,
    startDate: input.startDate,
    notes: input.notes,
    createdBy: adminId,
  });
  return { warranty: created, previous: null };
};

export const createClaim = async (
  input: CreateClaimInput,
  user: { id: string },
) => {
  const [productItem] = await db
    .select({
      id: productItems.id,
      productId: productItems.productId,
      status: productItems.status,
      serialNumber: productItems.serialNumber,
    })
    .from(productItems)
    .where(eq(productItems.id, input.productItemId))
    .limit(1);

  if (!productItem) {
    throw new Error("Unidad de inventario no encontrada");
  }

  const resolved = await resolveWarranty(productItem);
  if (!resolved || !resolved.delivered) {
    throw new Error(
      "Esta unidad no tiene un registro de venta o entrega — no se puede registrar garantía.",
    );
  }

  let warrantyId = resolved.warrantyId;
  if (!warrantyId) {
    const materialized = await materializeWarranty({
      productItemId: productItem.id,
      customerId: resolved.customer?.id ?? null,
      sourceType: (resolved.sourceType as "sale" | "layaway") ?? "manual",
      sourceId: resolved.sourceId,
      warrantyMonths: resolved.warrantyMonths,
      startDate: resolved.startDate as Date,
      createdBy: user.id,
    });
    warrantyId = materialized.id;
  }

  const withinWarranty = resolved.status === "vigente";

  const [claim] = await db
    .insert(warrantyClaims)
    .values({
      warrantyId,
      reportedSerial: input.reportedSerial?.trim() || productItem.serialNumber,
      issue: input.issue,
      withinWarranty,
      handledBy: user.id,
    })
    .returning();

  return { claim, withinWarranty };
};

export const updateClaimStatus = async (
  input: UpdateClaimStatusInput,
  userId: string,
) => {
  const isResolved =
    input.status === "reparado" ||
    input.status === "reemplazado" ||
    input.status === "rechazado";

  const [updated] = await db
    .update(warrantyClaims)
    .set({
      status: input.status,
      resolutionNotes: input.resolutionNotes,
      handledBy: userId,
      resolvedAt: isResolved ? new Date() : null,
    })
    .where(eq(warrantyClaims.id, input.claimId))
    .returning();

  if (!updated) {
    throw new Error("Reclamo no encontrado");
  }

  return updated;
};

export const getRecentClaims = async (limit = 50) => {
  return await db
    .select({
      id: warrantyClaims.id,
      issue: warrantyClaims.issue,
      status: warrantyClaims.status,
      withinWarranty: warrantyClaims.withinWarranty,
      reportedSerial: warrantyClaims.reportedSerial,
      reportedAt: warrantyClaims.reportedAt,
      resolvedAt: warrantyClaims.resolvedAt,
      resolutionNotes: warrantyClaims.resolutionNotes,
      productName: products.name,
      serialNumber: productItems.serialNumber,
      customerName: customers.name,
    })
    .from(warrantyClaims)
    .innerJoin(warranties, eq(warrantyClaims.warrantyId, warranties.id))
    .innerJoin(productItems, eq(warranties.productItemId, productItems.id))
    .innerJoin(products, eq(productItems.productId, products.id))
    .leftJoin(customers, eq(warranties.customerId, customers.id))
    .orderBy(desc(warrantyClaims.reportedAt))
    .limit(limit);
};
