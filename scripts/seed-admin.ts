import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { user } from "../src/db/schema";
import { auth } from "../src/lib/auth";

/**
 * Crea (o promueve) el usuario administrador.
 *
 * Se registra con la API de Better Auth para que la contraseña quede con el
 * mismo hash (scrypt) que el login valida. Insertar el hash a mano (antes se
 * usaba bcrypt) deja un usuario que nunca puede iniciar sesión.
 *
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/seed-admin.ts
 */
async function seedAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME || "Administrador";

  if (!adminEmail || !adminPassword) {
    throw new Error("Define ADMIN_EMAIL y ADMIN_PASSWORD.");
  }

  console.log(`🌱 Admin: ${adminEmail}`);

  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, adminEmail))
    .limit(1);

  if (existing) {
    console.log("👤 El usuario ya existe: solo se asegura el rol admin.");
  } else {
    await auth.api.signUpEmail({
      body: { email: adminEmail, password: adminPassword, name: adminName },
    });
    console.log("👤 Usuario creado.");
  }

  await db
    .update(user)
    .set({ role: "admin", emailVerified: true, updatedAt: new Date() })
    .where(eq(user.email, adminEmail));

  // Verifica que la contraseña realmente sirva para entrar.
  const session = await auth.api.signInEmail({
    body: { email: adminEmail, password: adminPassword },
  });
  if (!session.token) throw new Error("El login de verificación falló.");

  console.log("✅ Admin listo y login verificado.");
}

seedAdmin()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error creando admin:", error);
    process.exit(1);
  });
