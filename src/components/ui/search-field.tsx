"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { type SearchPriority, useSearchShortcut } from "@/providers/search-shortcut-provider";

interface SearchFieldProps extends Omit<React.ComponentProps<typeof Input>, "type"> {
  searchId: string;
  searchLabel: string;
  priority?: SearchPriority;
  onClear?: () => void;
}

export const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(
  ({ className, searchId, searchLabel, priority = "page", onClear, value, ...props }, forwardedRef) => {
    const internalRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(forwardedRef, () => internalRef.current as HTMLInputElement, []);
    useSearchShortcut({ id: searchId, ref: internalRef, label: searchLabel, priority });
    const canClear = value !== undefined && String(value).length > 0 && Boolean(onClear);

    return (
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={internalRef}
          type="search"
          value={value}
          className={cn("pl-9", canClear ? "pr-9" : "pr-3", className)}
          {...props}
          aria-keyshortcuts="Meta+K Control+K"
        />
        {canClear ? (
          <button type="button" onClick={onClear} className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Limpiar búsqueda">
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
    );
  },
);
SearchField.displayName = "SearchField";
