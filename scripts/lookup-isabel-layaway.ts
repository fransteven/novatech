/**
 * Lookup: find Isabel Guzman's layaway + device cost by IMEI 350912504997745
 * Run: npx tsx scripts/lookup-isabel-layaway.ts
 */
import "dotenv/config";
import { ilike, eq } from "drizzle-orm";
import { db } from "../src/db";
import { layaways, layawayDetails } from "../src/db/schema";
import { customers } from "../src/db/schema/customers";
import { productItems, products } from "../src/db/schema/inventory";

async function main() {
  // Find device by IMEI
  const [item] = await db
    .select({ id: productItems.id, serialNumber: productItems.serialNumber, unitCost: productItems.unitCost, productId: productItems.productId, status: productItems.status })
    .from(productItems)
    .where(eq(productItems.serialNumber, "350912504997745"))
    .limit(1);

  console.log("Device (IMEI 350912504997745):", item ?? "NOT FOUND");

  // Find Isabel layaways
  const rows = await db
    .select({
      layawayId: layaways.id,
      type: layaways.type,
      status: layaways.status,
      totalAmount: layaways.totalAmount,
      installmentAmount: layaways.installmentAmount,
      installmentCount: layaways.termMonths,
      interestRate: layaways.interestRate,
      financedCapital: layaways.financedCapital,
      outstandingPrincipal: layaways.outstandingPrincipal,
      createdAt: layaways.createdAt,
      expiresAt: layaways.expiresAt,
      customerName: customers.name,
    })
    .from(layaways)
    .innerJoin(customers, eq(layaways.customerId, customers.id))
    .where(ilike(customers.name, "%isabel%guzm%"));

  console.log("\nLayaways Isabel Guzman:");
  for (const r of rows) {
    console.log(r);

    const details = await db
      .select({ agreedPrice: layawayDetails.agreedPrice, productId: layawayDetails.productId, productItemId: layawayDetails.productItemId })
      .from(layawayDetails)
      .where(eq(layawayDetails.layawayId, r.layawayId));
    console.log("  Details:", details);
  }

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
