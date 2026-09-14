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
}

export function KpiCard({
  icon: Icon,
  title,
  value,
  description,
  trend,
  valueClassName,
  children,
}: KpiCardProps) {
  return (
    <Card variant="metric">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold", valueClassName)}>{value}</div>
        {children}
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
        {trend && (
          <p className="text-xs text-muted-foreground">
            {trend.value > 0 ? "+" : ""}
            {trend.value}%{" "}
            {trend.label ?? "respecto al mes pasado"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
