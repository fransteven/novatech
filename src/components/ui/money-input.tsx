import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface MoneyInputProps
  extends Omit<React.ComponentProps<"input">, "type"> {
  currencySymbol?: string;
  type?: "number" | "text";
}

export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ className, currencySymbol = "$", type = "number", ...props }, ref) => {
    return (
      <div className="relative w-full">
        <span
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground pointer-events-none select-none"
          aria-hidden="true"
        >
          {currencySymbol}
        </span>
        <Input
          ref={ref}
          type={type}
          inputMode="decimal"
          className={cn("pl-7 text-right font-mono", className)}
          {...props}
        />
      </div>
    );
  },
);

MoneyInput.displayName = "MoneyInput";
