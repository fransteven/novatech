/**
 * lead-service.ts — Lógica de negocio del módulo de Leads.
 *
 * Layers: schema → validator → service → actions → UI
 */

import { db } from "@/db";
import { leads, leadActivities, notifications, customers, products } from "@/db/schema";
import { eq, desc, and, sql, or, isNull } from "drizzle-orm";
import type {
  CreateLeadInput,
  UpdateLeadStageInput,
  AddLeadActivityInput,
  ConvertLeadToLayawayInput,
} from "@/lib/validators/lead-validator";
import { generateSchedule } from "@/lib/credit/amortization";
import { generateMarketingSuggestion } from "@/lib/leads/marketing";
import { createLayaway } from "./layaway-service";
import { createNotification } from "./notification-service";
import { money, toDbString } from "@/lib/money";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysBetween(a: Date, b: Date): number {
  return Math.floor(Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

const ACTIVE_STAGES = ["nuevo", "contactado", "negociando"] as const;
const FOLLOW_UP_DAYS = 2;

// ---------------------------------------------------------------------------
// createLead
// ---------------------------------------------------------------------------

export async function createLead(data: CreateLeadInput, userId?: string) {
  return db.transaction(async (tx) => {
    const [lead] = await tx
      .insert(leads)
      .values({
        prospectName: data.prospectName,
        prospectPhone: data.prospectPhone,
        productDescription: data.productDescription,
        costPrice: toDbString(data.costPrice),
        salePrice: toDbString(data.salePrice),
        interestRate: toDbString(data.interestRate),
        termMonths: data.termMonths,
        customerId: data.customerId ?? null,
        productId: data.productId ?? null,
        notes: data.notes ?? null,
        stage: "nuevo",
        createdBy: userId ?? null,
      })
      .returning();

    await tx.insert(leadActivities).values({
      leadId: lead.id,
      kind: "cambio_etapa",
      content: "Lead creado — etapa: nuevo",
      createdBy: userId ?? null,
    });

    return lead;
  });
}

// ---------------------------------------------------------------------------
// getLeads
// ---------------------------------------------------------------------------

export async function getLeads() {
  // Detectar leads sin seguimiento y generar notificaciones
  await detectFollowUpDue().catch(() => {
    // No bloquear la carga si falla
  });

  const rows = await db
    .select({
      id: leads.id,
      prospectName: leads.prospectName,
      prospectPhone: leads.prospectPhone,
      productDescription: leads.productDescription,
      costPrice: leads.costPrice,
      salePrice: leads.salePrice,
      interestRate: leads.interestRate,
      termMonths: leads.termMonths,
      stage: leads.stage,
      lostReason: leads.lostReason,
      lastContactedAt: leads.lastContactedAt,
      notes: leads.notes,
      layawayId: leads.layawayId,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
      customerId: leads.customerId,
      productId: leads.productId,
      customerName: customers.name,
      customerPhone: customers.phone,
      productName: products.name,
    })
    .from(leads)
    .leftJoin(customers, eq(leads.customerId, customers.id))
    .leftJoin(products, eq(leads.productId, products.id))
    .orderBy(desc(leads.updatedAt));

  const today = new Date();

  return rows.map((r) => {
    const refDate = r.lastContactedAt ?? r.createdAt;
    const daysSinceContact = daysBetween(refDate, today);
    return {
      ...r,
      costPrice: Number(r.costPrice),
      salePrice: Number(r.salePrice),
      interestRate: Number(r.interestRate),
      margin: Number(r.salePrice) - Number(r.costPrice),
      daysSinceContact,
    };
  });
}

// ---------------------------------------------------------------------------
// getLeadById
// ---------------------------------------------------------------------------

export async function getLeadById(id: string) {
  const [lead] = await db
    .select({
      id: leads.id,
      prospectName: leads.prospectName,
      prospectPhone: leads.prospectPhone,
      productDescription: leads.productDescription,
      costPrice: leads.costPrice,
      salePrice: leads.salePrice,
      interestRate: leads.interestRate,
      termMonths: leads.termMonths,
      stage: leads.stage,
      lostReason: leads.lostReason,
      lastContactedAt: leads.lastContactedAt,
      notes: leads.notes,
      layawayId: leads.layawayId,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
      customerId: leads.customerId,
      productId: leads.productId,
      customerName: customers.name,
      customerPhone: customers.phone,
      productName: products.name,
    })
    .from(leads)
    .leftJoin(customers, eq(leads.customerId, customers.id))
    .leftJoin(products, eq(leads.productId, products.id))
    .where(eq(leads.id, id))
    .limit(1);

  if (!lead) return null;

  const activities = await db
    .select()
    .from(leadActivities)
    .where(eq(leadActivities.leadId, id))
    .orderBy(desc(leadActivities.createdAt));

  const today = new Date();
  const refDate = lead.lastContactedAt ?? lead.createdAt;

  return {
    ...lead,
    costPrice: Number(lead.costPrice),
    salePrice: Number(lead.salePrice),
    interestRate: Number(lead.interestRate),
    margin: Number(lead.salePrice) - Number(lead.costPrice),
    daysSinceContact: daysBetween(refDate, today),
    activities,
  };
}

// ---------------------------------------------------------------------------
// updateLeadStage
// ---------------------------------------------------------------------------

export async function updateLeadStage(
  data: UpdateLeadStageInput,
  userId?: string
) {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ stage: leads.stage })
      .from(leads)
      .where(eq(leads.id, data.leadId))
      .limit(1);

    if (!current) throw new Error("Lead no encontrado");

    const now = new Date();
    const setContactedAt =
      data.stage === "contactado" ? { lastContactedAt: now } : {};

    await tx
      .update(leads)
      .set({
        stage: data.stage,
        lostReason: data.stage === "perdido" ? (data.lostReason ?? null) : null,
        updatedAt: now,
        ...setContactedAt,
      })
      .where(eq(leads.id, data.leadId));

    await tx.insert(leadActivities).values({
      leadId: data.leadId,
      kind: "cambio_etapa",
      content: `Etapa cambiada: ${current.stage} → ${data.stage}${
        data.lostReason ? ` | Motivo: ${data.lostReason}` : ""
      }`,
      createdBy: userId ?? null,
    });
  });
}

// ---------------------------------------------------------------------------
// addLeadActivity
// ---------------------------------------------------------------------------

export async function addLeadActivity(
  data: AddLeadActivityInput,
  userId?: string
) {
  const now = new Date();

  const [activity] = await db
    .insert(leadActivities)
    .values({
      leadId: data.leadId,
      kind: data.kind,
      content: data.content,
      createdBy: userId ?? null,
    })
    .returning();

  // Si se registra un contacto manual, actualizar lastContactedAt
  if (data.kind === "contacto") {
    await db
      .update(leads)
      .set({ lastContactedAt: now, updatedAt: now })
      .where(eq(leads.id, data.leadId));
  }

  return activity;
}

// ---------------------------------------------------------------------------
// previewAmortization
// ---------------------------------------------------------------------------

export async function previewAmortization(leadId: string) {
  const [lead] = await db
    .select({
      salePrice: leads.salePrice,
      interestRate: leads.interestRate,
      termMonths: leads.termMonths,
    })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  if (!lead) throw new Error("Lead no encontrado");

  return generateSchedule({
    principal: Number(lead.salePrice),
    monthlyRate: Number(lead.interestRate),
    termMonths: lead.termMonths,
    startDate: new Date(),
  });
}

// ---------------------------------------------------------------------------
// getMarketingSuggestion
// ---------------------------------------------------------------------------

export async function getMarketingSuggestion(leadId: string, userId?: string) {
  const lead = await getLeadById(leadId);
  if (!lead) throw new Error("Lead no encontrado");

  const suggestion = await generateMarketingSuggestion({
    prospectName: lead.prospectName,
    prospectPhone: lead.prospectPhone,
    productDescription: lead.productDescription,
    salePrice: lead.salePrice,
    costPrice: lead.costPrice,
    interestRate: lead.interestRate,
    termMonths: lead.termMonths,
    stage: lead.stage,
    daysSinceLastContact: lead.daysSinceContact,
    notes: lead.notes,
  });

  // Guardar como actividad para historial
  await db.insert(leadActivities).values({
    leadId,
    kind: "ia_sugerencia",
    content: suggestion,
    createdBy: userId ?? null,
  });

  return suggestion;
}

// ---------------------------------------------------------------------------
// convertLeadToLayaway
// ---------------------------------------------------------------------------

export async function convertLeadToLayaway(
  data: ConvertLeadToLayawayInput,
  userId?: string
) {
  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, data.leadId))
    .limit(1);

  if (!lead) throw new Error("Lead no encontrado");
  if (lead.stage === "ganado") throw new Error("Este lead ya fue convertido");
  if (lead.stage === "perdido") throw new Error("No se puede convertir un lead perdido");

  // Marcar como ganado primero
  await updateLeadStage({ leadId: data.leadId, stage: "ganado" }, userId);

  // Crear el crédito (layaway)
  const newLayaway = await createLayaway({
    customerId: data.customerId,
    type: "credito",
    items: [
      {
        productId: data.productId,
        productItemId: null,
        quantity: 1,
        price: Number(lead.salePrice),
        isSerialized: false,
      },
    ],
    totalAmount: Number(lead.salePrice),
    initialDeposit: data.initialDeposit ?? 0,
    termMonths: lead.termMonths,
    expiresAt: data.expiresAt,
    paymentMethod: data.paymentMethod,
    accountId: data.accountId,
  });

  // Enlazar lead con layaway creado
  await db
    .update(leads)
    .set({ layawayId: newLayaway.id, updatedAt: new Date() })
    .where(eq(leads.id, data.leadId));

  await db.insert(leadActivities).values({
    leadId: data.leadId,
    kind: "cambio_etapa",
    content: `Convertido a crédito. ID Apartado: ${newLayaway.id.slice(0, 8)}`,
    createdBy: userId ?? null,
  });

  return newLayaway;
}

// ---------------------------------------------------------------------------
// detectFollowUpDue — genera notificaciones para leads sin seguimiento
// ---------------------------------------------------------------------------

export async function detectFollowUpDue(): Promise<void> {
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - FOLLOW_UP_DAYS);

  // Leads activos sin contacto (o cuyo contacto fue hace > FOLLOW_UP_DAYS días)
  const staleLeads = await db
    .select({
      id: leads.id,
      prospectName: leads.prospectName,
      productDescription: leads.productDescription,
      stage: leads.stage,
      lastContactedAt: leads.lastContactedAt,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .where(
      and(
        sql`${leads.stage} IN ('nuevo', 'contactado', 'negociando')`,
        or(
          isNull(leads.lastContactedAt),
          sql`${leads.lastContactedAt} <= ${cutoff}`
        )
      )
    );

  for (const lead of staleLeads) {
    const refDate = lead.lastContactedAt ?? lead.createdAt;
    const days = daysBetween(refDate, today);
    const todayStr = today.toISOString().slice(0, 10);

    await createNotification({
      type: "seguimiento_lead",
      layawayId: undefined,
      leadId: lead.id,
      title: "Lead sin seguimiento",
      message: `${lead.prospectName} (${lead.productDescription}) lleva ${days} día(s) sin contacto. Etapa: ${lead.stage}.`,
      severity: days >= 5 ? "danger" : "warning",
      dedupeKey: `seguimiento_lead:${lead.id}:${todayStr}`,
    });
  }
}
