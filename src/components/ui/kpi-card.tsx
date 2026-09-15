import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  icon: LucideIcon;
  title: string;
  value: string | number;
  description?: string;
  trend?: { value: number; label?: string };
  valueClassName?: string;
  children?: React.ReactNode;
  emphasis?: "primary" | "default";
}

export function KpiCard({
  icon: Icon,
  title,
  value,
  description,
  trend,
  valueClassName,
  children,
  emphasis = "default",
}: KpiCardProps) {
  return (
    <Card variant={emphasis === "primary" ? "metric" : "surface"} className={cn(emphasis === "primary" && "border-[var(--tf-border-strong)]")}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
        <div className="flex items-center gap-2">
          <span className={cn("grid size-6 place-items-center rounded-sm bg-muted", emphasis === "primary" && "bg-primary text-primary-foreground")}>
            <Icon className="size-3.5" />
          </span>
          <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</CardTitle>
        </div>
        {emphasis === "primary" ? <span className="mono text-[10px] font-semibold text-[color:var(--tf-fg-subtle)]">30D</span> : null}
      </CardHeader>
      <CardContent>
        <div className={cn("mono text-[26px] font-semibold tracking-[-0.04em]", valueClassName)}>{value}</div>
        {children}
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
        {trend && (
          <p className="mono mt-2 text-[11px] text-muted-foreground">
            <span className={cn("font-semibold", trend.value < 0 ? "text-destructive" : "text-[color:var(--tf-green)]")}>{trend.value > 0 ? "+" : ""}{trend.value}%</span>{" "}
            {trend.label ?? "respecto al mes pasado"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
