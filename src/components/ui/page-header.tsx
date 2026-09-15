import * as React from "react";
import { type LucideIcon } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  eyebrow?: string;
}

export function PageHeader({ title, description, icon: Icon, actions, eyebrow = "OPERACIÓN" }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
      <div className="tf-trace-rail pl-4">
        <p className="mono mb-1 text-[10px] font-semibold tracking-[0.14em] text-[color:var(--tf-fg-subtle)]">{eyebrow}</p>
        <h1 className="mb-1.5 flex items-center gap-2 text-[28px] font-bold leading-tight tracking-[-0.035em]">
          {Icon ? <Icon className="h-5 w-5 text-primary" /> : null}
          {title}
        </h1>
        {description && (
          <p className="max-w-[540px] text-sm text-[color:var(--tf-fg-muted)]">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
