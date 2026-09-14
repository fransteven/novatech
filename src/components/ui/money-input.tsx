import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatNumberCO, parseCurrencyInput } from "@/lib/formatters";

export interface MoneyInputProps
  extends Omit<React.ComponentProps<"input">, "type" | "value" | "onChange"> {
  currencySymbol?: string;
  /** Valor numérico en pesos COP; el vacío se representa con null. */
  value: number | null;
  onValueChange: (value: number | null) => void;
}

export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ className, currencySymbol = "$", value, onValueChange, onBlur, ...props }, ref) => {
    const displayValue = value === null ? "" : formatNumberCO(value);
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
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={(event) => {
            const nextValue = parseCurrencyInput(event.target.value);
            onValueChange(nextValue);
          }}
          onBlur={onBlur}
          className={cn("pl-7 text-right font-mono tabular-nums", className)}
          {...props}
        />
      </div>
    );
  },
);

MoneyInput.displayName = "MoneyInput";
