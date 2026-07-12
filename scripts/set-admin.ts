import "dotenv/config";
import { db } from "../src/db";
import { user } from "../src/db/schema/auth";
import { eq } from "drizzle-orm";

// Uso: npx tsx scripts/set-admin.ts correo@ejemplo.com
async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Uso: npx tsx scripts/set-admin.ts correo@ejemplo.com");
    process.exit(1);
  }

  const [updated] = await db
    .update(user)
    .set({ role: "admin" })
    .where(eq(user.email, email))
    .returning({ id: user.id, email: user.email, role: user.role });

  if (!updated) {
    console.error(`No se encontró ningún usuario con email ${email}`);
    process.exit(1);
  }

  console.log(`Usuario actualizado a admin:`, updated);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
