"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  Store,
  CalendarClock,
  Settings2,
  TrendingUp,
  Banknote,
  Smartphone,
  PiggyBank,
  PackageSearch,
  PanelLeft,
  User,
  LogOut,
  Menu,
  Wallet,
  ShoppingCart,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { authClient } from "@/lib/auth-client";

const operacion = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Punto de Venta", href: "/pos", icon: Store },
  { title: "Inventario", href: "/inventory", icon: ClipboardList },
  { title: "Catálogo", href: "/catalog", icon: Package },
  { title: "Compras", href: "/purchases", icon: ShoppingCart },
  { title: "Apartados", href: "/layaways", icon: CalendarClock },
  { title: "Peritaje iPhones", href: "/iphone-purchase-checklist", icon: Smartphone },
];

const analisis = [
  { title: "Caja", href: "/cash", icon: Wallet },
  { title: "Ventas", href: "/sales", icon: TrendingUp },
  { title: "Ganancias", href: "/profits", icon: PiggyBank },
  { title: "Accionistas", href: "/accionistas", icon: Users },
  { title: "Gastos", href: "/expenses", icon: Banknote },
  { title: "Importaciones", href: "/import-costs", icon: PackageSearch },
];

type NavItem = { title: string; href: string; icon: React.ElementType };

function NavLink({
  item,
  isActive,
  collapsed,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed?: boolean;
}) {
  return (
    <Link
      href={item.href}
      title={collapsed ? item.title : undefined}
      className={cn(
        "relative flex items-center gap-3 px-3 py-[9px] rounded-[10px] text-[13.5px] font-medium transition-colors duration-150",
        isActive
          ? "tf-nav-rail bg-accent text-accent-foreground font-semibold"
          : "text-[color:var(--tf-fg-muted)] hover:bg-muted hover:text-foreground",
        collapsed && "justify-center",
      )}
    >
      <item.icon className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && <span className="flex-1 whitespace-nowrap">{item.title}</span>}
    </Link>
  );
}

type SidebarProps = React.HTMLAttributes<HTMLDivElement>;

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const { data: session } = authClient.useSession();
  const user = session?.user;

  const userInitials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/sign-in");
  };

  const navSection = (label: string, items: NavItem[], collapsed?: boolean) => (
    <>
      {!collapsed && (
        <div className="px-3 pt-[14px] pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--tf-fg-subtle)]">
          {label}
        </div>
      )}
      {collapsed && <div className="h-2" />}
      {items.map((item) => (
        <NavLink key={item.href} item={item} isActive={pathname === item.href} collapsed={collapsed} />
      ))}
    </>
  );

  const footerUser = (collapsed: boolean) => (
    <div className="border-t border-border p-3">
      <div className="flex items-center gap-[10px] p-2 rounded-[10px] transition-colors duration-150 hover:bg-muted cursor-default">
        <div className="relative shrink-0">
          <Avatar className="h-9 w-9">
            <AvatarImage src={user?.image ?? ""} alt={user?.name ?? "Usuario"} />
            <AvatarFallback
              className="text-[13px] font-semibold"
              style={{ background: "linear-gradient(135deg, oklch(0.7 0.14 200), oklch(0.65 0.18 305))", color: "white" }}
            >
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <span
            className="absolute bottom-0 right-0 w-[10px] h-[10px] rounded-full border-2 border-card"
            style={{ background: "var(--tf-green)" }}
          />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold truncate">{user?.name}</div>
            <div className="text-[11.5px] text-[color:var(--tf-fg-subtle)] truncate">{user?.email}</div>
          </div>
        )}
      </div>
      {!collapsed && (
        <div className="flex gap-1 mt-2">
          <Link
            href="/profile"
            className="flex flex-1 items-center justify-center gap-[6px] py-2 px-2 rounded-lg text-[12px] font-medium text-[color:var(--tf-fg-muted)] hover:bg-muted hover:text-foreground transition-colors duration-150"
          >
            <User className="h-3.5 w-3.5" />
            <span>Cuenta</span>
          </Link>
          <button
            onClick={handleSignOut}
            className="flex flex-1 items-center justify-center gap-[6px] py-2 px-2 rounded-lg text-[12px] font-medium text-[color:var(--tf-fg-muted)] hover:bg-[var(--tf-red-soft)] hover:text-[color:var(--tf-red)] transition-colors duration-150"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Salir</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile trigger */}
      <Sheet>
        <SheetTrigger asChild>
          <button className="md:hidden fixed top-4 left-4 z-50 h-9 w-9 rounded-lg border border-border bg-card flex items-center justify-center text-[color:var(--tf-fg-muted)] hover:bg-muted transition-colors">
            <Menu className="h-4 w-4" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[264px] p-0 bg-card border-r border-border flex flex-col">
          {/* Mobile brand */}
          <div className="flex items-center gap-[10px] px-[18px] py-[18px] border-b border-border min-h-16">
            <div
              className="w-9 h-9 rounded-[9px] grid place-items-center shrink-0"
              style={{ background: "linear-gradient(135deg, var(--tf-accent), oklch(0.5 0.2 295))", boxShadow: "0 4px 14px var(--tf-accent-ring), inset 0 1px 0 rgb(255 255 255 / 0.3)" }}
            >
              <Settings2 className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="text-[15px] font-semibold tracking-[-0.02em]">NovaTech</div>
              <div className="text-[11px] text-[color:var(--tf-fg-subtle)] font-medium">Suite de Comercio · v3.4</div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto py-[6px] px-[10px] flex flex-col gap-0.5">
            {navSection("Operación", operacion)}
            {navSection("Análisis", analisis)}
          </nav>

          {user && footerUser(false)}
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex md:flex-col sticky top-0 h-screen bg-card border-r border-border overflow-hidden z-30 transition-all duration-[250ms] ease-[cubic-bezier(.4,0,.2,1)]",
          isCollapsed ? "w-[72px]" : "w-[264px]",
          className,
        )}
      >
        {/* Brand */}
        <div className="flex items-center gap-[10px] px-[18px] border-b border-border min-h-16"
          style={{ paddingTop: 18, paddingBottom: 14 }}>
          <div
            className="w-9 h-9 rounded-[9px] grid place-items-center shrink-0"
            style={{ background: "linear-gradient(135deg, var(--tf-accent), oklch(0.5 0.2 295))", boxShadow: "0 4px 14px var(--tf-accent-ring), inset 0 1px 0 rgb(255 255 255 / 0.3)" }}
          >
            <Settings2 className="h-4 w-4 text-white" />
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold tracking-[-0.02em] whitespace-nowrap">NovaTech</div>
              <div className="text-[11px] text-[color:var(--tf-fg-subtle)] font-medium whitespace-nowrap">Suite de Comercio · v3.4</div>
            </div>
          )}
          {!isCollapsed && (
            <button
              onClick={() => setIsCollapsed(true)}
              className="ml-auto w-7 h-7 rounded-md grid place-items-center text-[color:var(--tf-fg-muted)] hover:bg-muted hover:text-foreground transition-colors duration-150"
              aria-label="Colapsar menú"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-[6px] px-[10px] flex flex-col gap-0.5">
          {navSection("Operación", operacion, isCollapsed)}
          {navSection("Análisis", analisis, isCollapsed)}
        </nav>

        {/* Footer */}
        {user && footerUser(isCollapsed)}

        {/* Expand button (collapsed only) */}
        {isCollapsed && (
          <button
            onClick={() => setIsCollapsed(false)}
            className="absolute top-[18px] right-3 w-7 h-7 rounded-md grid place-items-center text-[color:var(--tf-fg-muted)] hover:bg-muted hover:text-foreground transition-colors duration-150"
            aria-label="Expandir menú"
          >
            <PanelLeft className="h-4 w-4 rotate-180" />
          </button>
        )}
      </aside>
    </>
  );
}
