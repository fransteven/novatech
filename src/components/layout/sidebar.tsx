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
  LogOut,
  Wallet,
  ShoppingCart,
  Users,
  Target,
  HandCoins,
  ShieldCheck,
  Landmark,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { authClient } from "@/lib/auth-client";

const operacion = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Punto de Venta", href: "/pos", icon: Store },
  { title: "Inventario", href: "/inventory", icon: ClipboardList },
  { title: "Catálogo", href: "/catalog", icon: Package },
  { title: "Compras", href: "/purchases", icon: ShoppingCart },
  { title: "Apartados", href: "/layaways", icon: CalendarClock },
  { title: "Leads", href: "/leads", icon: Target },
  { title: "Garantías", href: "/garantias", icon: ShieldCheck },
  { title: "Peritaje iPhones", href: "/iphone-purchase-checklist", icon: Smartphone },
];

const analisis = [
  { title: "Caja", href: "/cash", icon: Wallet },
  { title: "Ventas", href: "/sales", icon: TrendingUp },
  { title: "Ganancias", href: "/profits", icon: PiggyBank },
  { title: "Accionistas", href: "/accionistas", icon: Users },
  { title: "Gastos", href: "/expenses", icon: Banknote },
  { title: "Importaciones", href: "/import-costs", icon: PackageSearch },
  { title: "Acreedores", href: "/acreedores", icon: HandCoins },
  { title: "Préstamos", href: "/prestamos", icon: Landmark },
];

type NavItem = { title: string; href: string; icon: React.ElementType };

function NavLink({
  item,
  isActive,
  collapsed,
  mobile,
  onNavClick,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed?: boolean;
  mobile?: boolean;
  onNavClick?: () => void;
}) {
  return (
    <Link
      href={item.href}
      title={collapsed ? item.title : undefined}
      onClick={onNavClick}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-md px-3 text-[13px] font-medium transition-[color,background-color] duration-[140ms] ease-[cubic-bezier(.2,.8,.2,1)]",
        mobile ? "py-3" : "py-[9px]",
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

/** Renders nav sections — proper component so usePathname works */
function NavSections({
  collapsed,
  mobile,
  onNavClick,
}: {
  collapsed?: boolean;
  mobile?: boolean;
  onNavClick?: () => void;
}) {
  const pathname = usePathname();

  const section = (label: string, items: NavItem[]) => (
    <>
      {!collapsed && (
        <div className="px-3 pt-[14px] pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--tf-fg-subtle)]">
          {label}
        </div>
      )}
      {collapsed && <div className="h-2" />}
      {items.map((item) => (
        <NavLink
          key={item.href}
          item={item}
          isActive={pathname === item.href}
          collapsed={collapsed}
          mobile={mobile}
          onNavClick={onNavClick}
        />
      ))}
    </>
  );

  return (
    <nav className="flex-1 overflow-y-auto py-[6px] px-[10px] flex flex-col gap-0.5">
      {section("Operación", operacion)}
      {section("Análisis", analisis)}
    </nav>
  );
}

function FooterUser({
  collapsed,
  onSignOut,
}: {
  collapsed: boolean;
  onSignOut: () => void;
}) {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const userInitials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  return (
    <div className="border-t border-border p-3">
      <div className="flex items-center gap-[10px] p-2 rounded-[10px] transition-colors duration-150 hover:bg-muted cursor-default">
        <div className="relative shrink-0">
          <Avatar className="h-9 w-9">
            <AvatarImage src={user?.image ?? ""} alt={user?.name ?? "Usuario"} />
            <AvatarFallback
              className="bg-accent text-[13px] font-semibold text-accent-foreground"
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
          <button
            onClick={onSignOut}
            className="flex w-full items-center justify-center gap-[6px] rounded-md px-2 py-2 text-[12px] font-medium text-[color:var(--tf-fg-muted)] transition-colors duration-[140ms] hover:bg-[var(--tf-red-soft)] hover:text-[color:var(--tf-red)]"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Salir</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Shared brand header ──────────────────────────────────────────

function NavBrand({ collapsed, children }: { collapsed?: boolean; children?: React.ReactNode }) {
  return (
    <div
      className="flex min-h-14 items-center gap-[10px] border-b border-border px-4"
    >
      <div
        className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground"
      >
        <Settings2 className="h-4 w-4" />
      </div>
      {!collapsed && (
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold tracking-[-0.02em] whitespace-nowrap">NovaTech</div>
          <div className="text-[11px] text-[color:var(--tf-fg-subtle)] font-medium whitespace-nowrap">
            Suite de Comercio · v3.4
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

// ── Mobile drawer (controlled by Navbar) ────────────────────────

export function MobileNav({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const user = session?.user;

  const close = () => onOpenChange(false);

  const handleSignOut = async () => {
    close();
    await authClient.signOut();
    router.push("/sign-in");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="sm:w-[232px] sm:max-w-[232px] p-0 bg-card border-r border-border flex flex-col">
        <NavBrand />
        <NavSections mobile onNavClick={close} />
        {user && <FooterUser collapsed={false} onSignOut={handleSignOut} />}
      </SheetContent>
    </Sheet>
  );
}

// ── Desktop sidebar ──────────────────────────────────────────────

type SidebarProps = React.HTMLAttributes<HTMLDivElement>;

export function Sidebar({ className }: SidebarProps) {
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const { data: session } = authClient.useSession();
  const user = session?.user;

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/sign-in");
  };

  return (
    <aside
      className={cn(
        "hidden lg:flex lg:flex-col sticky top-0 h-screen bg-card border-r border-border overflow-hidden z-30 transition-[width] duration-[240ms] ease-[cubic-bezier(.2,.8,.2,1)]",
        isCollapsed ? "w-[68px]" : "w-[232px]",
        className,
      )}
    >
      <NavBrand collapsed={isCollapsed}>
        {!isCollapsed && (
          <button
            onClick={() => setIsCollapsed(true)}
            className="ml-auto grid size-7 place-items-center rounded-md text-[color:var(--tf-fg-muted)] transition-colors duration-[140ms] hover:bg-muted hover:text-foreground"
            aria-label="Colapsar menú"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        )}
      </NavBrand>

      <NavSections collapsed={isCollapsed} />

      {user && <FooterUser collapsed={isCollapsed} onSignOut={handleSignOut} />}

      {isCollapsed && (
        <button
          onClick={() => setIsCollapsed(false)}
          className="absolute right-3 top-[14px] grid size-7 place-items-center rounded-md text-[color:var(--tf-fg-muted)] transition-colors duration-[140ms] hover:bg-muted hover:text-foreground"
          aria-label="Expandir menú"
        >
          <PanelLeft className="h-4 w-4 rotate-180" />
        </button>
      )}
    </aside>
  );
}
