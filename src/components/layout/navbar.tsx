"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Moon, Sun, Search, ChevronRight, LogOut, User as UserIcon, Settings, Menu } from "lucide-react";
import { NotificationsBell } from "@/components/layaways/notifications-bell";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MobileNav } from "@/components/layout/sidebar";

const PAGE_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/pos": "Punto de Venta",
  "/inventory": "Inventario",
  "/catalog": "Catálogo",
  "/layaways": "Apartados",
  "/iphone-purchase-checklist": "Peritaje iPhones",
  "/sales": "Ventas",
  "/profits": "Ganancias",
  "/expenses": "Gastos",
  "/import-costs": "Importaciones",
  "/reservations": "Reservas",
};

const SECTION_LABELS: Record<string, string> = {
  "/dashboard": "Operación",
  "/pos": "Operación",
  "/inventory": "Operación",
  "/catalog": "Operación",
  "/layaways": "Operación",
  "/iphone-purchase-checklist": "Operación",
  "/sales": "Análisis",
  "/profits": "Análisis",
  "/expenses": "Análisis",
  "/import-costs": "Análisis",
};

export function Navbar() {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const pathname = usePathname();

  const [theme, setTheme] = React.useState<"light" | "dark">("dark");
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  const applyTheme = React.useCallback((t: "light" | "dark") => {
    document.documentElement.dataset.theme = t;
    if (t === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("tf-theme", t);
  }, []);

  React.useEffect(() => {
    const saved = localStorage.getItem("tf-theme") as "light" | "dark" | null;
    const initial = saved ?? "dark";
    applyTheme(initial);
    setTheme(initial);
  }, [applyTheme]);

  // Auto-close mobile nav on route change
  React.useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    applyTheme(next);
    setTheme(next);
  };

  const userInitials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const pageLabel = PAGE_LABELS[pathname] ?? "";
  const sectionLabel = SECTION_LABELS[pathname] ?? "";

  return (
    <>
      <MobileNav open={mobileNavOpen} onOpenChange={setMobileNavOpen} />

      <header
        className="sticky top-0 z-20 flex items-center gap-2 sm:gap-3 px-4 md:px-7 min-h-[60px] border-b border-border"
        style={{
          background: "color-mix(in oklch, var(--tf-bg-elev) 80%, transparent)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        {/* Mobile hamburger — inline in header, no fixed/overlap */}
        <button
          className="md:hidden h-9 w-9 rounded-lg border border-border bg-card flex items-center justify-center text-[color:var(--tf-fg-muted)] hover:bg-muted transition-colors shrink-0"
          aria-label="Abrir menú"
          onClick={() => setMobileNavOpen(true)}
        >
          <Menu className="h-4 w-4" />
        </button>

        {/* Breadcrumb: full on sm+, compact on mobile */}
        <div className="flex items-center gap-2 text-[13px] text-[color:var(--tf-fg-muted)] min-w-0">
          {/* Mobile: only page label */}
          <b className="text-foreground font-semibold truncate sm:hidden">
            {pageLabel || "NovaTech"}
          </b>

          {/* Desktop: full breadcrumb */}
          <span className="hidden sm:inline">NovaTech</span>
          {sectionLabel && (
            <>
              <ChevronRight className="hidden sm:inline h-3.5 w-3.5 text-[color:var(--tf-fg-subtle)] shrink-0" />
              <span className="hidden sm:inline">{sectionLabel}</span>
            </>
          )}
          {pageLabel && (
            <>
              <ChevronRight className="hidden sm:inline h-3.5 w-3.5 text-[color:var(--tf-fg-subtle)] shrink-0" />
              <b className="hidden sm:inline text-foreground font-semibold">{pageLabel}</b>
            </>
          )}
        </div>

        <div className="flex-1" />

        {/* Search — hidden on mobile */}
        <div
          className="hidden sm:flex items-center gap-2 w-[280px] h-9 px-[10px] rounded-lg border border-transparent text-[13px] tf-focus-ring transition-all duration-150"
          style={{ background: "var(--tf-bg-muted)" }}
        >
          <Search className="h-3.5 w-3.5 text-[color:var(--tf-fg-subtle)] shrink-0" />
          <input
            placeholder="Buscar en NovaTech..."
            className="flex-1 bg-transparent border-0 outline-none text-[13px] placeholder:text-[color:var(--tf-fg-subtle)]"
            readOnly
          />
          <span
            className="text-[10.5px] px-1.5 py-px rounded border border-border text-[color:var(--tf-fg-subtle)]"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            ⌘K
          </span>
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="h-9 w-9 rounded-lg grid place-items-center text-[color:var(--tf-fg-muted)] hover:bg-muted hover:text-foreground transition-colors duration-150"
          aria-label="Cambiar tema"
        >
          {theme === "light" ? <Moon className="h-[17px] w-[17px]" /> : <Sun className="h-[17px] w-[17px]" />}
        </button>

        {/* Bell */}
        <NotificationsBell />

        {/* Avatar dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 p-0">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.image || ""} alt={user?.name || "Usuario"} />
                <AvatarFallback className="text-xs font-semibold bg-accent text-accent-foreground">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <span className="sr-only">Menú de usuario</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.name}</p>
                <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile" className="cursor-pointer">
                <UserIcon className="mr-2 h-4 w-4" />
                <span>Perfil</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                <span>Configuración</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/sign-out" className="cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar Sesión</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
    </>
  );
}
