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
import { eq, and, or, ilike, desc, sql, inArray, type SQL } from "drizzle-orm";
import {
  AdjustWarrantyInput,
  CreateClaimInput,
  UpdateClaimStatusInput,
  WarrantyAnchor,
  WarrantySearchInput,
} from "@/lib/validators/warranty-validator";
import { DEFAULT_WARRANTY_MONTHS } from "@/lib/warranty/warranty-calc";
import {
  resolveWarrantyRow,
  matchesStatusFilter,
  type WarrantyStatus,
} from "@/lib/warranty/warranty-row";
import { serialSearchKey } from "@/lib/serials";

export { DEFAULT_WARRANTY_MONTHS };

/**
 * Estados que cuentan como ENTREGA real del equipo. Una cotización o un
 * apartado cancelado nunca salió de la vitrina, así que no puede arrancar una
 * garantía. Un crédito en mora (`defaulted`) sí: el cliente tiene el equipo,
 * solo dejó de pagar.
 */
const DELIVERED_SALE_STATUSES = ["completed"];
const DELIVERED_LAYAWAY_STATUSES = ["active", "completed", "defaulted"];

/** Techo de filas que trae cada rama de la búsqueda antes de mezclar. */
const SEARCH_BRANCH_LIMIT = 200;
/** Filas devueltas a la UI tras mezclar, ordenar y filtrar por estado. */
const SEARCH_RESULT_LIMIT = 100;

/**
 * Normaliza un serial en SQL igual que `serialSearchKey` en TypeScript: sin
 * espacios ni guiones y en mayúsculas, para que un IMEI dictado en bloques
 * ("352 099-00 176148") encuentre el guardado corrido.
 */
const normalizedSerialSql = sql`UPPER(REPLACE(REPLACE(COALESCE(${productItems.serialNumber}, ''), ' ', ''), '-', ''))`;

/** Teléfono sin separadores, para buscar por número dictado de cualquier forma. */
const normalizedPhoneSql = sql`REGEXP_REPLACE(COALESCE(${customers.phone}, ''), '[^0-9]', '', 'g')`;

// ---------------------------------------------------------------------------
// Búsqueda
// ---------------------------------------------------------------------------

export type WarrantySearchRow = {
  /** Id estable para React: identifica la línea de entrega. */
  key: string;
  anchor: WarrantyAnchor;
  sourceType: "sale" | "layaway";
  sourceId: string;
  productId: string;
  productName: string;
  sku: string | null;
  productItemId: string | null;
  serialNumber: string | null;
  customerId: string | null;
  customerName: string | null;
  customerDocument: string | null;
  customerPhone: string | null;
  deliveredAt: Date;
  startDate: Date;
  warrantyMonths: number;
  expiryDate: Date;
  status: WarrantyStatus;
  daysRemaining: number;
  isProvisional: boolean;
  warrantyId: string | null;
};

type DeliveryRaw = {
  detailId: string;
  sourceId: string;
  productItemId: string | null;
  productId: string;
  productName: string;
  productSku: string | null;
  itemSku: string | null;
  serialNumber: string | null;
  productWarrantyMonths: number | null;
  customerId: string | null;
  customerName: string | null;
  customerDocument: string | null;
  customerPhone: string | null;
  deliveredAt: Date;
  warrantyId: string | null;
  warrantyStartDate: Date | null;
  warrantyMonths: number | null;
  warrantyStatus: string | null;
  warrantyNotes: string | null;
};

/**
 * Condiciones OR del texto libre. Cubre las formas en que se consulta una
 * garantía en mostrador: IMEI (completo o últimos dígitos), SKU, nombre del
 * producto, nombre/cédula/teléfono del cliente y N° (o prefijo) del documento
 * de venta o apartado.
 */
const buildTextConditions = (rawQuery: string, sourceIdColumn: SQL) => {
  const q = rawQuery.trim();
  const conditions: SQL[] = [];
  if (!q) return conditions;

  const like = `%${q}%`;
  conditions.push(ilike(products.name, like));
  conditions.push(ilike(products.sku, like));
  conditions.push(ilike(productItems.sku, like));
  conditions.push(ilike(customers.name, like));
  conditions.push(ilike(customers.documentId, like));

  const serialKey = serialSearchKey(q);
  if (serialKey) {
    conditions.push(sql`${normalizedSerialSql} LIKE ${`%${serialKey}%`}`);
  }

  const phoneDigits = q.replace(/[^0-9]/g, "");
  if (phoneDigits.length >= 3) {
    conditions.push(sql`${normalizedPhoneSql} LIKE ${`%${phoneDigits}%`}`);
  }

  // N° de venta/apartado: el UUID completo o su prefijo, como se muestra en la UI.
  conditions.push(sql`${sourceIdColumn}::text ILIKE ${`${q}%`}`);

  return conditions;
};

const dateConditions = (
  effectiveDate: SQL,
  from?: Date,
  to?: Date,
): SQL[] => {
  const conditions: SQL[] = [];
  if (from) conditions.push(sql`${effectiveDate} >= ${from}`);
  if (to) conditions.push(sql`${effectiveDate} <= ${to}`);
  return conditions;
};

const searchSaleDeliveries = async (
  filters: WarrantySearchInput,
): Promise<DeliveryRaw[]> => {
  const effectiveDate = sql`COALESCE(${warranties.startDate}, ${sales.createdAt})`;

  const where: SQL[] = [inArray(sales.status, DELIVERED_SALE_STATUSES)];
  const text = buildTextConditions(filters.q ?? "", sql`${sales.id}`);
  if (text.length > 0) where.push(or(...text) as SQL);
  where.push(...dateConditions(effectiveDate, filters.from, filters.to));

  const rows = await db
    .select({
      detailId: saleDetails.id,
      sourceId: sales.id,
      productItemId: saleDetails.productItemId,
      productId: saleDetails.productId,
      productName: products.name,
      productSku: products.sku,
      itemSku: productItems.sku,
      serialNumber: productItems.serialNumber,
      productWarrantyMonths: products.warrantyMonths,
      customerId: sales.customerId,
      customerName: customers.name,
      customerDocument: customers.documentId,
      customerPhone: customers.phone,
      deliveredAt: sales.createdAt,
      warrantyId: warranties.id,
      warrantyStartDate: warranties.startDate,
      warrantyMonths: warranties.warrantyMonths,
      warrantyStatus: warranties.status,
      warrantyNotes: warranties.notes,
    })
    .from(saleDetails)
    .innerJoin(sales, eq(saleDetails.saleId, sales.id))
    .innerJoin(products, eq(saleDetails.productId, products.id))
    .leftJoin(productItems, eq(saleDetails.productItemId, productItems.id))
    .leftJoin(customers, eq(sales.customerId, customers.id))
    .leftJoin(
      warranties,
      or(
        eq(warranties.saleDetailId, saleDetails.id),
        eq(warranties.productItemId, saleDetails.productItemId),
      ),
    )
    .where(and(...where))
    .orderBy(desc(sales.createdAt))
    .limit(SEARCH_BRANCH_LIMIT);

  return rows;
};

const searchLayawayDeliveries = async (
  filters: WarrantySearchInput,
): Promise<DeliveryRaw[]> => {
  const effectiveDate = sql`COALESCE(${warranties.startDate}, ${layaways.createdAt})`;

  const where: SQL[] = [inArray(layaways.status, DELIVERED_LAYAWAY_STATUSES)];
  const text = buildTextConditions(filters.q ?? "", sql`${layaways.id}`);
  if (text.length > 0) where.push(or(...text) as SQL);
  where.push(...dateConditions(effectiveDate, filters.from, filters.to));

  const rows = await db
    .select({
      detailId: layawayDetails.id,
      sourceId: layaways.id,
      productItemId: layawayDetails.productItemId,
      productId: layawayDetails.productId,
      productName: products.name,
      productSku: products.sku,
      itemSku: productItems.sku,
      serialNumber: productItems.serialNumber,
      productWarrantyMonths: products.warrantyMonths,
      customerId: layaways.customerId,
      customerName: customers.name,
      customerDocument: customers.documentId,
      customerPhone: customers.phone,
      deliveredAt: layaways.createdAt,
      warrantyId: warranties.id,
      warrantyStartDate: warranties.startDate,
      warrantyMonths: warranties.warrantyMonths,
      warrantyStatus: warranties.status,
      warrantyNotes: warranties.notes,
    })
    .from(layawayDetails)
    .innerJoin(layaways, eq(layawayDetails.layawayId, layaways.id))
    .innerJoin(products, eq(layawayDetails.productId, products.id))
    .leftJoin(productItems, eq(layawayDetails.productItemId, productItems.id))
    .leftJoin(customers, eq(layaways.customerId, customers.id))
    .leftJoin(
      warranties,
      or(
        eq(warranties.layawayDetailId, layawayDetails.id),
        eq(warranties.productItemId, layawayDetails.productItemId),
      ),
    )
    .where(and(...where))
    .orderBy(desc(layaways.createdAt))
    .limit(SEARCH_BRANCH_LIMIT);

  return rows;
};

const toSearchRow = (
  raw: DeliveryRaw,
  sourceType: "sale" | "layaway",
  now: Date,
): WarrantySearchRow => {
  const resolved = resolveWarrantyRow(raw, now);

  return {
    key: `${sourceType}:${raw.detailId}`,
    anchor:
      sourceType === "sale"
        ? { saleDetailId: raw.detailId }
        : { layawayDetailId: raw.detailId },
    sourceType,
    sourceId: raw.sourceId,
    productId: raw.productId,
    productName: raw.productName,
    sku: raw.itemSku ?? raw.productSku,
    productItemId: raw.productItemId,
    serialNumber: raw.serialNumber,
    customerId: raw.customerId,
    customerName: raw.customerName,
    customerDocument: raw.customerDocument,
    customerPhone: raw.customerPhone,
    deliveredAt: raw.deliveredAt,
    warrantyId: raw.warrantyId,
    ...resolved,
  };
};

export type WarrantySearchResult = {
  rows: WarrantySearchRow[];
  /**
   * El serial buscado existe en inventario pero no tiene entrega registrada.
   * Sirve para distinguir "todavía no se ha vendido" de "no es nuestro"
   * (posible sustitución de equipo en el mostrador).
   */
  serialInInventoryWithoutDelivery: boolean;
  /** El texto buscado no coincide con ningún serial del inventario. */
  serialUnknown: boolean;
};

/**
 * Busca garantías por IMEI/serial (parcial), cliente (nombre, cédula o
 * teléfono), producto, N° de venta/apartado y rango de fechas de entrega.
 *
 * Corre una consulta por origen (ventas y apartados) y las mezcla en memoria en
 * lugar de un UNION: son dos joins distintos y a esta escala mezclar es más
 * legible que mantener SQL crudo. El filtro vigente/vencida también se aplica en
 * TS para que la aritmética de vencimiento viva en un solo sitio
 * (`resolveWarrantyRow`), no duplicada en SQL.
 */
export const searchWarranties = async (
  filters: WarrantySearchInput,
): Promise<WarrantySearchResult> => {
  const now = new Date();

  const [saleRows, layawayRows] = await Promise.all([
    filters.sourceType === "layaway" ? Promise.resolve([]) : searchSaleDeliveries(filters),
    filters.sourceType === "sale" ? Promise.resolve([]) : searchLayawayDeliveries(filters),
  ]);

  const statusFilter = filters.status ?? "todas";

  const rows = [
    ...saleRows.map((r) => toSearchRow(r, "sale", now)),
    ...layawayRows.map((r) => toSearchRow(r, "layaway", now)),
  ]
    .filter((row) => matchesStatusFilter(row.status, statusFilter))
    .sort((a, b) => b.deliveredAt.getTime() - a.deliveredAt.getTime())
    .slice(0, SEARCH_RESULT_LIMIT);

  // Diagnóstico del caso "no encontré nada": ¿el serial es nuestro pero sin
  // vender, o simplemente no existe? La respuesta cambia lo que se le dice al
  // cliente en el mostrador.
  let serialInInventoryWithoutDelivery = false;
  let serialUnknown = false;

  const serialKey = serialSearchKey(filters.q ?? "");
  if (rows.length === 0 && serialKey.length >= 3) {
    const [match] = await db
      .select({ id: productItems.id })
      .from(productItems)
      .where(sql`${normalizedSerialSql} LIKE ${`%${serialKey}%`}`)
      .limit(1);
    serialInInventoryWithoutDelivery = Boolean(match);
    serialUnknown = !match;
  }

  return { rows, serialInInventoryWithoutDelivery, serialUnknown };
};

// ---------------------------------------------------------------------------
// Detalle de una garantía
// ---------------------------------------------------------------------------

/** Condición SQL que localiza una garantía materializada por su ancla. */
const anchorCondition = (anchor: WarrantyAnchor): SQL => {
  if (anchor.saleDetailId) {
    return eq(warranties.saleDetailId, anchor.saleDetailId);
  }
  if (anchor.layawayDetailId) {
    return eq(warranties.layawayDetailId, anchor.layawayDetailId);
  }
  return eq(warranties.productItemId, anchor.productItemId as string);
};

/**
 * Traduce cualquier ancla a la línea de entrega concreta. Un `productItemId`
 * (típico al escanear) se resuelve a su venta o apartado más reciente: si una
 * unidad se devolvió y se revendió, manda la entrega vigente.
 */
const findDeliveryByAnchor = async (
  anchor: WarrantyAnchor,
): Promise<{ raw: DeliveryRaw; sourceType: "sale" | "layaway" } | null> => {
  if (anchor.saleDetailId) {
    const [row] = await searchSaleDeliveriesByDetail(anchor.saleDetailId);
    return row ? { raw: row, sourceType: "sale" } : null;
  }
  if (anchor.layawayDetailId) {
    const [row] = await searchLayawayDeliveriesByDetail(anchor.layawayDetailId);
    return row ? { raw: row, sourceType: "layaway" } : null;
  }

  const productItemId = anchor.productItemId as string;
  const [saleRow] = await searchSaleDeliveriesByItem(productItemId);
  if (saleRow) return { raw: saleRow, sourceType: "sale" };
  const [layawayRow] = await searchLayawayDeliveriesByItem(productItemId);
  if (layawayRow) return { raw: layawayRow, sourceType: "layaway" };
  return null;
};

const searchSaleDeliveriesByDetail = (detailId: string) =>
  saleDeliveryQuery(eq(saleDetails.id, detailId));

const searchSaleDeliveriesByItem = (productItemId: string) =>
  saleDeliveryQuery(eq(saleDetails.productItemId, productItemId));

const searchLayawayDeliveriesByDetail = (detailId: string) =>
  layawayDeliveryQuery(eq(layawayDetails.id, detailId));

const searchLayawayDeliveriesByItem = (productItemId: string) =>
  layawayDeliveryQuery(eq(layawayDetails.productItemId, productItemId));

const saleDeliveryQuery = (extra: SQL) =>
  db
    .select({
      detailId: saleDetails.id,
      sourceId: sales.id,
      productItemId: saleDetails.productItemId,
      productId: saleDetails.productId,
      productName: products.name,
      productSku: products.sku,
      itemSku: productItems.sku,
      serialNumber: productItems.serialNumber,
      productWarrantyMonths: products.warrantyMonths,
      customerId: sales.customerId,
      customerName: customers.name,
      customerDocument: customers.documentId,
      customerPhone: customers.phone,
      deliveredAt: sales.createdAt,
      warrantyId: warranties.id,
      warrantyStartDate: warranties.startDate,
      warrantyMonths: warranties.warrantyMonths,
      warrantyStatus: warranties.status,
      warrantyNotes: warranties.notes,
    })
    .from(saleDetails)
    .innerJoin(sales, eq(saleDetails.saleId, sales.id))
    .innerJoin(products, eq(saleDetails.productId, products.id))
    .leftJoin(productItems, eq(saleDetails.productItemId, productItems.id))
    .leftJoin(customers, eq(sales.customerId, customers.id))
    .leftJoin(
      warranties,
      or(
        eq(warranties.saleDetailId, saleDetails.id),
        eq(warranties.productItemId, saleDetails.productItemId),
      ),
    )
    .where(and(inArray(sales.status, DELIVERED_SALE_STATUSES), extra))
    .orderBy(desc(sales.createdAt))
    .limit(1);

const layawayDeliveryQuery = (extra: SQL) =>
  db
    .select({
      detailId: layawayDetails.id,
      sourceId: layaways.id,
      productItemId: layawayDetails.productItemId,
      productId: layawayDetails.productId,
      productName: products.name,
      productSku: products.sku,
      itemSku: productItems.sku,
      serialNumber: productItems.serialNumber,
      productWarrantyMonths: products.warrantyMonths,
      customerId: layaways.customerId,
      customerName: customers.name,
      customerDocument: customers.documentId,
      customerPhone: customers.phone,
      deliveredAt: layaways.createdAt,
      warrantyId: warranties.id,
      warrantyStartDate: warranties.startDate,
      warrantyMonths: warranties.warrantyMonths,
      warrantyStatus: warranties.status,
      warrantyNotes: warranties.notes,
    })
    .from(layawayDetails)
    .innerJoin(layaways, eq(layawayDetails.layawayId, layaways.id))
    .innerJoin(products, eq(layawayDetails.productId, products.id))
    .leftJoin(productItems, eq(layawayDetails.productItemId, productItems.id))
    .leftJoin(customers, eq(layaways.customerId, customers.id))
    .leftJoin(
      warranties,
      or(
        eq(warranties.layawayDetailId, layawayDetails.id),
        eq(warranties.productItemId, layawayDetails.productItemId),
      ),
    )
    .where(and(inArray(layaways.status, DELIVERED_LAYAWAY_STATUSES), extra))
    .orderBy(desc(layaways.createdAt))
    .limit(1);

const getClaimsForWarranty = (warrantyId: string) =>
  db
    .select()
    .from(warrantyClaims)
    .where(eq(warrantyClaims.warrantyId, warrantyId))
    .orderBy(desc(warrantyClaims.reportedAt));

export type WarrantyDetail = WarrantySearchRow & {
  notes: string | null;
  claims: Awaited<ReturnType<typeof getClaimsForWarranty>>;
};

/**
 * Detalle completo de la garantía de una entrega, incluidos los reclamos
 * previos. Acepta cualquiera de las tres anclas: unidad serializada, línea de
 * venta o línea de apartado.
 */
export const getWarrantyDetail = async (
  anchor: WarrantyAnchor,
): Promise<WarrantyDetail | null> => {
  const found = await findDeliveryByAnchor(anchor);
  if (!found) return null;

  const row = toSearchRow(found.raw, found.sourceType, new Date());
  const claims = row.warrantyId
    ? await getClaimsForWarranty(row.warrantyId)
    : [];

  return { ...row, notes: found.raw.warrantyNotes, claims };
};

// ---------------------------------------------------------------------------
// Materialización y ajuste
// ---------------------------------------------------------------------------

/**
 * Persiste la garantía derivada (o la crea manualmente) para que quede como
 * fuente autoritativa — se dispara al registrar el primer reclamo de una
 * entrega, o al ajustar manualmente la fecha de entrega.
 */
export const materializeWarranty = async (input: {
  anchor: WarrantyAnchor;
  productItemId: string | null;
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
    .where(anchorCondition(input.anchor))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(warranties)
    .values({
      productItemId: input.productItemId,
      saleDetailId: input.anchor.saleDetailId ?? null,
      layawayDetailId: input.anchor.layawayDetailId ?? null,
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
 * garantía. Necesario porque en apartados/créditos el equipo a veces se entrega
 * antes de que el sistema tenga otra señal de "entrega".
 */
export const adjustWarranty = async (
  input: AdjustWarrantyInput,
  adminId: string,
) => {
  const detail = await getWarrantyDetail(input.anchor);
  if (!detail) {
    throw new Error("No hay una entrega registrada para esta garantía");
  }

  const [existing] = await db
    .select()
    .from(warranties)
    .where(anchorCondition(input.anchor))
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

  const created = await materializeWarranty({
    anchor: input.anchor,
    productItemId: detail.productItemId,
    customerId: detail.customerId,
    sourceType: detail.sourceType,
    sourceId: detail.sourceId,
    warrantyMonths: input.warrantyMonths,
    startDate: input.startDate,
    notes: input.notes,
    createdBy: adminId,
  });
  return { warranty: created, previous: null };
};

// ---------------------------------------------------------------------------
// Reclamos
// ---------------------------------------------------------------------------

export const createClaim = async (
  input: CreateClaimInput,
  user: { id: string },
) => {
  const detail = await getWarrantyDetail(input.anchor);
  if (!detail) {
    throw new Error(
      "Esta unidad no tiene un registro de venta o entrega — no se puede registrar garantía.",
    );
  }

  let warrantyId = detail.warrantyId;
  if (!warrantyId) {
    const materialized = await materializeWarranty({
      anchor: input.anchor,
      productItemId: detail.productItemId,
      customerId: detail.customerId,
      sourceType: detail.sourceType,
      sourceId: detail.sourceId,
      warrantyMonths: detail.warrantyMonths,
      startDate: detail.startDate,
      createdBy: user.id,
    });
    warrantyId = materialized.id;
  }

  const withinWarranty = detail.status === "vigente";

  const [claim] = await db
    .insert(warrantyClaims)
    .values({
      warrantyId,
      reportedSerial: input.reportedSerial?.trim() || detail.serialNumber,
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
    .leftJoin(productItems, eq(warranties.productItemId, productItems.id))
    .leftJoin(saleDetails, eq(warranties.saleDetailId, saleDetails.id))
    .leftJoin(layawayDetails, eq(warranties.layawayDetailId, layawayDetails.id))
    .innerJoin(
      products,
      or(
        eq(products.id, productItems.productId),
        eq(products.id, saleDetails.productId),
        eq(products.id, layawayDetails.productId),
      ),
    )
    .leftJoin(customers, eq(warranties.customerId, customers.id))
    .orderBy(desc(warrantyClaims.reportedAt))
    .limit(limit);
};
