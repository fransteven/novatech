import "dotenv/config";
import { ilike, eq } from "drizzle-orm";
import { db } from "../src/db";
import { layaways, layawayDetails } from "../src/db/schema";
import { customers } from "../src/db/schema/customers";
import { productItems, products } from "../src/db/schema/inventory";

async function main() {
  const rows = await db
    .select({
      layawayId: layaways.id,
      type: layaways.type,
      status: layaways.status,
      totalAmount: layaways.totalAmount,
      installmentAmount: layaways.installmentAmount,
      termMonths: layaways.termMonths,
      interestRate: layaways.interestRate,
      financedCapital: layaways.financedCapital,
      outstandingPrincipal: layaways.outstandingPrincipal,
      createdAt: layaways.createdAt,
      expiresAt: layaways.expiresAt,
      customerName: customers.name,
    })
    .from(layaways)
    .innerJoin(customers, eq(layaways.customerId, customers.id))
    .where(ilike(customers.name, "%yimari%"));

  for (const r of rows) {
    console.log("Layaway:", r);
    const details = await db
      .select({
        agreedPrice: layawayDetails.agreedPrice,
        productItemId: layawayDetails.productItemId,
        productId: layawayDetails.productId,
      })
      .from(layawayDetails)
      .where(eq(layawayDetails.layawayId, r.layawayId));
    console.log("  Details:", details);

    for (const d of details) {
      if (d.productItemId) {
        const [item] = await db
          .select({ serialNumber: productItems.serialNumber, unitCost: productItems.unitCost, status: productItems.status })
          .from(productItems)
          .where(eq(productItems.id, d.productItemId))
          .limit(1);
        console.log("  Item:", item);
      }
      const [prod] = await db
        .select({ name: products.name, price: products.price })
        .from(products)
        .where(eq(products.id, d.productId))
        .limit(1);
      console.log("  Product:", prod);
    }
  }

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
