"use client";

import * as React from "react";
import { Package, Tag, DollarSign, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { ProductWithStock } from "@/services/product-service";

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  sub: string;
  icon: React.ReactNode;
  iconBg: string;
  iconFg: string;
  glow: string;
  alert?: boolean;
}

function KpiCard({ label, value, sub, icon, iconBg, iconFg, glow, alert }: KpiCardProps) {
  return (
    <div
      className={`relative overflow-hidden bg-card border border-border rounded-[14px] p-5 transition-all duration-200 hover:-translate-y-0.5${alert ? " tf-kpi-alert" : ""}`}
      style={{ boxShadow: "var(--tf-shadow-sm)" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(120% 60% at 100% 0%, ${glow}, transparent 50%)`,
          opacity: 0.4,
        }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-2">
            {label}
          </p>
          <div className="text-[28px] font-bold tracking-[-0.03em] tabular-nums leading-tight text-foreground break-all">
            {value}
          </div>
          <p className="text-[12px] text-muted-foreground mt-1.5">{sub}</p>
        </div>
        <div
          className="w-9 h-9 rounded-[9px] flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: iconBg, color: iconFg }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

export function CatalogKpis({ products }: { products: ProductWithStock[] }) {
  const totalProducts = products.length;
  const activeCategories = new Set(products.map((p) => p.categoryId).filter(Boolean)).size;
  const catalogValue = products.reduce(
    (s, p) => s + parseFloat(String(p.price)) * (p.stock || 0),
    0,
  );
  const noCategory = products.filter((p) => !p.categoryId).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        label="Total Productos"
        value={totalProducts}
        sub="Productos en el catálogo"
        icon={<Package className="h-[18px] w-[18px]" />}
        iconBg="oklch(0.62 0.18 265 / 0.15)"
        iconFg="oklch(0.62 0.18 265)"
        glow="oklch(0.62 0.18 265 / 0.18)"
      />
      <KpiCard
        label="Categorías Activas"
        value={activeCategories}
        sub="Categorías con productos"
        icon={<Tag className="h-[18px] w-[18px]" />}
        iconBg="oklch(0.65 0.16 150 / 0.15)"
        iconFg="oklch(0.65 0.16 150)"
        glow="oklch(0.65 0.16 150 / 0.16)"
      />
      <KpiCard
        label="Valor del Catálogo"
        value={
          <span className="text-[22px]">{formatCurrency(catalogValue)}</span>
        }
        sub="Precio de venta × stock actual"
        icon={<DollarSign className="h-[18px] w-[18px]" />}
        iconBg="oklch(0.65 0.16 200 / 0.15)"
        iconFg="oklch(0.65 0.16 200)"
        glow="oklch(0.65 0.16 200 / 0.16)"
      />
      <KpiCard
        label="Sin Categoría"
        value={noCategory}
        sub={noCategory > 0 ? "Requieren categorización" : "Todo categorizado"}
        icon={<AlertTriangle className="h-[18px] w-[18px]" />}
        iconBg="oklch(0.72 0.15 70 / 0.15)"
        iconFg="oklch(0.72 0.15 70)"
        glow="oklch(0.72 0.15 70 / 0.18)"
        alert={noCategory > 0}
      />
    </div>
  );
}
