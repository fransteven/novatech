import "dotenv/config";
import { ilike, eq, and, inArray } from "drizzle-orm";
import { db } from "../src/db";
import { layaways, layawayDetails } from "../src/db/schema";
import { customers } from "../src/db/schema/customers";
import { cashMovements } from "../src/db/schema/cash";

async function main() {
  const rows = await db
    .select({
      layawayId: layaways.id,
      type: layaways.type,
      status: layaways.status,
      totalAmount: layaways.totalAmount,
      outstandingPrincipal: layaways.outstandingPrincipal,
      customerName: customers.name,
      customerId: layaways.customerId,
    })
    .from(layaways)
    .innerJoin(customers, eq(layaways.customerId, customers.id))
    .where(ilike(customers.name, "%gia%"));

  console.log("Layaways Gia:", JSON.stringify(rows, null, 2));

  for (const r of rows) {
    const details = await db
      .select({ agreedPrice: layawayDetails.agreedPrice, productItemId: layawayDetails.productItemId, productId: layawayDetails.productId })
      .from(layawayDetails)
      .where(eq(layawayDetails.layawayId, r.layawayId));
    console.log("Details:", details);

    const payments = await db
      .select({ id: cashMovements.id, amount: cashMovements.amount, sourceType: cashMovements.sourceType, occurredAt: cashMovements.occurredAt, notes: cashMovements.notes })
      .from(cashMovements)
      .where(and(
        eq(cashMovements.sourceId, r.layawayId),
        inArray(cashMovements.sourceType, ["layaway_deposit", "layaway_payment"]),
        eq(cashMovements.status, "posted")
      ))
      .orderBy(cashMovements.occurredAt);
    console.log("Payments:", JSON.stringify(payments, null, 2));
  }

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
