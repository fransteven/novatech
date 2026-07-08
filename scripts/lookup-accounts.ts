import "dotenv/config";
import { db } from "../src/db";
import { cashAccounts } from "../src/db/schema/cash";

async function main() {
  const accounts = await db.select().from(cashAccounts);
  console.log(JSON.stringify(accounts, null, 2));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
