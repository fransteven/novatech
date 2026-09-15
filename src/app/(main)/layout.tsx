import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/sign-in");
  return (
    <div className="flex min-h-screen w-full bg-background">
      <a className="sr-only fixed left-3 top-3 z-[60] rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only" href="#main-content">
        Saltar al contenido
      </a>
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Navbar />
        <main id="main-content" className="flex-1 overflow-auto" tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}
