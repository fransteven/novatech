import "dotenv/config";
import { and, eq, ilike } from "drizzle-orm";
import { db } from "../src/db";
import { layaways, layawayPayments, layawaySchedule } from "../src/db/schema";
import { customers } from "../src/db/schema/customers";
import { cashMovements } from "../src/db/schema/cash";

async function main() {
  const rows = await db
    .select({
      layawayId: layaways.id,
      customerName: customers.name,
      type: layaways.type,
      status: layaways.status,
      totalAmount: layaways.totalAmount,
      outstandingPrincipal: layaways.outstandingPrincipal,
    })
    .from(layaways)
    .innerJoin(customers, eq(layaways.customerId, customers.id))
    .where(ilike(customers.name, "%fernando%"));

  if (rows.length === 0) {
    console.error("❌ No se encontró layaway para 'fernando'.");
    process.exit(1);
  }

  for (const r of rows) {
    console.log("\nLayaway:", r);

    const payments = await db
      .select()
      .from(layawayPayments)
      .where(eq(layawayPayments.layawayId, r.layawayId));
    console.log(`\nLayaway payments (${payments.length}):`);
    for (const p of payments) {
      console.log(`  id=${p.id}`);
      console.log(`  idempotencyKey=${p.idempotencyKey}`);
      console.log(`  amount=${p.amount} | scheduleNumber=${p.scheduleNumber} | type=${p.type}`);
      console.log(`  cashMovementId=${p.cashMovementId}`);
      console.log(`  createdAt=${p.createdAt}`);
      console.log("");
    }

    const cms = await db
      .select()
      .from(cashMovements)
      .where(
        and(
          eq(cashMovements.sourceId, r.layawayId),
          eq(cashMovements.status, "posted"),
        )
      )
      .orderBy(cashMovements.occurredAt);
    console.log(`Cash movements (${cms.length}):`);
    for (const m of cms) {
      console.log(`  id=${m.id}`);
      console.log(`  sourceType=${m.sourceType} | amount=${m.amount} | occurredAt=${m.occurredAt?.toISOString?.() ?? m.occurredAt}`);
      console.log(`  notes=${m.notes}`);
      console.log("");
    }

    const sched = await db
      .select()
      .from(layawaySchedule)
      .where(eq(layawaySchedule.layawayId, r.layawayId));
    console.log(`Schedule (${sched.length} cuotas):`);
    for (const s of sched) {
      console.log(`  #${s.number} | due=${s.dueDate?.toISOString?.() ?? s.dueDate} | total=${s.totalAmount} | status=${s.status}`);
    }
  }

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
