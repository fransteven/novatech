import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center p-4">
      {/* Branding / Header */}
      <div className="mb-8 flex flex-col items-center space-y-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="h-8 w-8"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            NovaTech
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestión inteligente de inventario
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-md">{children}</div>

      {/* Footer Info (Optional) */}
      <div className="mt-8 text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} NovaTech Inc. Todos los derechos
        reservados.
      </div>
    </div>
  );
}
