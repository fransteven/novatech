import "dotenv/config";
import { ilike } from "drizzle-orm";
import { db } from "../src/db";
import { leads } from "../src/db/schema";

async function main() {
  const rows = await db
    .select({
      id: leads.id,
      prospectName: leads.prospectName,
      stage: leads.stage,
      productDescription: leads.productDescription,
      costPrice: leads.costPrice,
      salePrice: leads.salePrice,
      interestRate: leads.interestRate,
      termMonths: leads.termMonths,
      layawayId: leads.layawayId,
    })
    .from(leads)
    .where(ilike(leads.prospectName, "%iphone 16 pro%"));

  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
