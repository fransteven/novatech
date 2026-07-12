import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export type AppRole = "admin" | "seller" | "user";

export interface SessionUser {
  id: string;
  name: string;
  role: AppRole;
}

/**
 * Envuelve el patrón repetido `auth.api.getSession({ headers: await headers() })`
 * usado en los server actions. Devuelve el usuario de la sesión (con rol tipado)
 * o null si no hay sesión activa.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const role = (session.user as { role?: string }).role;

  return {
    id: session.user.id,
    name: session.user.name,
    role: role === "admin" || role === "seller" ? role : "user",
  };
}

/**
 * Guardia de autorización para server actions que solo el rol admin puede
 * ejecutar (ej. corregir registros de inventario ya capturados). Lanza un
 * Error con mensaje seguro para mostrar al usuario si no aplica.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("No autorizado");
  }
  if (user.role !== "admin") {
    throw new Error("Permiso denegado: se requiere rol de administrador");
  }
  return user;
}
