import "dotenv/config";
import { ilike, eq } from "drizzle-orm";
import { db } from "../src/db";
import { layaways, layawayDetails, layawayPayments, layawaySchedule } from "../src/db/schema";
import { customers } from "../src/db/schema/customers";
import { productItems } from "../src/db/schema/inventory";

async function main() {
  const rows = await db
    .select({
      layawayId: layaways.id,
      customerId: layaways.customerId,
      customerName: customers.name,
      type: layaways.type,
      status: layaways.status,
      subStatus: layaways.subStatus,
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
    .innerJoin(customers, eq(layaways.customerId, customers.id))
    .where(ilike(customers.name, "%stephania%"));

  console.log("Layaways for Stephania:");
  for (const r of rows) {
    console.log(r);

    const details = await db
      .select()
      .from(layawayDetails)
      .where(eq(layawayDetails.layawayId, r.layawayId));
    console.log("  Details:", details);

    const payments = await db
      .select()
      .from(layawayPayments)
      .where(eq(layawayPayments.layawayId, r.layawayId));
    console.log("  Payments:", payments);

    const sched = await db
      .select()
      .from(layawaySchedule)
      .where(eq(layawaySchedule.layawayId, r.layawayId));
    console.log("  Schedule:", sched);

    if (details[0]?.productItemId) {
      const [item] = await db
        .select({ serialNumber: productItems.serialNumber, status: productItems.status })
        .from(productItems)
        .where(eq(productItems.id, details[0].productItemId))
        .limit(1);
      console.log("  ProductItem:", item);
    }
  }

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
