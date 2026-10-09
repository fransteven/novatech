import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { layaways, layawayPayments, layawaySchedule, layawayDetails } from "../src/db/schema";
import { customers } from "../src/db/schema/customers";
import { cashMovements } from "../src/db/schema/cash";

const ID = "76a7591b-5958-4ce6-85da-4ad762257724";
async function main() {
  const [l] = await db.select().from(layaways).where(eq(layaways.id, ID));
  console.log(l);
  if (!l) process.exit(1);
  const [c] = await db.select().from(customers).where(eq(customers.id, l.customerId!));
  console.log("customer:", c?.name);
  console.log("details:", await db.select().from(layawayDetails).where(eq(layawayDetails.layawayId, ID)));
  console.log("payments:", await db.select().from(layawayPayments).where(eq(layawayPayments.layawayId, ID)));
  console.log("cash:", await db.select().from(cashMovements).where(eq(cashMovements.sourceId, ID)));
  const s = await db.select().from(layawaySchedule).where(eq(layawaySchedule.layawayId, ID)).orderBy(layawaySchedule.number);
  for (const x of s) console.log(`#${x.number} ${x.dueDate?.toISOString()} tot=${x.totalAmount} int=${x.interest} prin=${x.principal} bal=${x.remainingBalance} paid=${x.paidAmount ?? ""} ${x.status}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
