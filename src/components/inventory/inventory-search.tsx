"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

export function InventorySearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [query, setQuery] = useState(searchParams.get("query") || "");
  const debouncedQuery = useDebounce(query, 400);

  useEffect(() => {
    const currentQuery = searchParams.get("query") || "";
    if (currentQuery === debouncedQuery) return;

    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (debouncedQuery) {
        params.set("query", debouncedQuery);
      } else {
        params.delete("query");
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }, [debouncedQuery, pathname, router, searchParams]);

  return (
    <div
      className="flex items-center gap-2 flex-1 min-w-[240px] h-9 rounded-lg border border-transparent px-3 tf-focus-ring transition-all duration-150"
      style={{ background: "var(--tf-bg-muted)" }}
    >
      <Search className="h-[15px] w-[15px] text-[color:var(--tf-fg-subtle)] shrink-0" />
      <input
        type="text"
        placeholder="Buscar por SKU o nombre de producto..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="flex-1 bg-transparent border-0 outline-none text-[13px] placeholder:text-[color:var(--tf-fg-subtle)]"
      />
      {isPending && (
        <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      )}
      {query && !isPending && (
        <button
          onClick={() => setQuery("")}
          aria-label="Limpiar búsqueda"
          className="h-[18px] w-[18px] rounded-full grid place-items-center text-[color:var(--tf-fg-subtle)] hover:text-foreground bg-card shrink-0"
        >
          <X className="h-[11px] w-[11px]" />
        </button>
      )}
    </div>
  );
}
