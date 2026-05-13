import * as React from "react";
import { type LucideIcon } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, icon: Icon, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 mb-6">
      <div>
        <h1 className="text-[28px] font-bold tracking-[-0.025em] leading-tight flex items-center gap-2 mb-[6px]">
          {Icon && <Icon className="h-7 w-7 text-primary" />}
          {title}
        </h1>
        {description && (
          <p className="text-[14.5px] text-[color:var(--tf-fg-muted)] max-w-[540px]">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-[10px] shrink-0">{actions}</div>
      )}
    </div>
  );
}
