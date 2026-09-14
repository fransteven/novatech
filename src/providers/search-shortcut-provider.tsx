"use client";

import * as React from "react";

export type SearchPriority = "page" | "overlay";

export interface SearchTarget {
  id: string;
  ref: React.RefObject<HTMLInputElement | null>;
  label: string;
  active?: boolean;
  priority?: SearchPriority;
  onTrigger?: () => void;
}

interface SearchShortcutContextValue {
  register: (target: SearchTarget) => () => void;
  focusActiveSearch: () => boolean;
  activeLabel: string | null;
}

const SearchShortcutContext = React.createContext<SearchShortcutContextValue | null>(null);

export const isTargetUsable = (input: HTMLInputElement | null): input is HTMLInputElement => {
  if (!input || input.disabled || input.getClientRects().length === 0) return false;
  return !input.closest("[aria-hidden='true'], [inert]");
};

export const getPriorityScore = (priority: SearchPriority | undefined) =>
  priority === "overlay" ? 2 : 1;

export const isSearchShortcutEvent = (event: Pick<KeyboardEvent, "altKey" | "ctrlKey" | "isComposing" | "key" | "keyCode" | "metaKey" | "shiftKey">) =>
  !event.isComposing && event.keyCode !== 229 && !event.altKey && !event.shiftKey &&
  (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";

export const resolveSearchTarget = <T extends Pick<SearchTarget, "active" | "priority">>(
  targets: readonly T[],
  isUsable: (target: T) => boolean,
) => targets.reduce<T | null>((best, target) => {
  if (target.active === false || !isUsable(target)) return best;
  if (!best || getPriorityScore(target.priority) >= getPriorityScore(best.priority)) return target;
  return best;
}, null);

export const SearchShortcutProvider = ({ children }: { children: React.ReactNode }) => {
  const targetsRef = React.useRef(new Map<string, SearchTarget>());
  const [revision, setRevision] = React.useState(0);
  const [activeLabel, setActiveLabel] = React.useState<string | null>(null);

  const getDeclarativeTargets = React.useCallback((): SearchTarget[] => {
    if (typeof document === "undefined") return [];

    return Array.from(document.querySelectorAll<HTMLInputElement>("input[data-search-shortcut]"))
      .map((input, index) => {
        // Declarative inputs participate in the same accessible shortcut contract as SearchField.
        if (!input.hasAttribute("aria-keyshortcuts")) {
          input.setAttribute("aria-keyshortcuts", "Meta+K Control+K");
        }
        return {
          id: input.dataset.searchId ?? `declarative-search-${index}`,
          ref: { current: input },
          label: input.dataset.searchLabel ?? input.placeholder ?? "Búsqueda",
          active: input.dataset.searchActive !== "false",
          priority: input.dataset.searchPriority === "overlay" ? "overlay" : "page",
        };
      });
  }, []);

  const resolveTarget = React.useCallback(() => {
    const allTargets = [...targetsRef.current.values(), ...getDeclarativeTargets()];
    return resolveSearchTarget(allTargets, (target) => isTargetUsable(target.ref.current));
  }, [getDeclarativeTargets]);

  const focusActiveSearch = React.useCallback(() => {
    const target = resolveTarget();
    if (!target) return false;
    target.onTrigger?.();
    requestAnimationFrame(() => {
      target.ref.current?.focus();
      target.ref.current?.select();
    });
    return true;
  }, [resolveTarget]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isSearchShortcutEvent(event)) {
        if (focusActiveSearch()) event.preventDefault();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusActiveSearch]);

  React.useEffect(() => {
    queueMicrotask(() => setActiveLabel(resolveTarget()?.label ?? null));
  }, [resolveTarget, revision]);

  React.useEffect(() => {
    const observer = new MutationObserver(() => setRevision((current) => current + 1));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-search-shortcut", "data-search-active", "data-search-priority", "disabled", "aria-hidden", "inert"] });
    return () => observer.disconnect();
  }, []);

  const register = React.useCallback((target: SearchTarget) => {
    targetsRef.current.set(target.id, target);
    setRevision((current) => current + 1);
    return () => {
      targetsRef.current.delete(target.id);
      setRevision((current) => current + 1);
    };
  }, []);

  const value = React.useMemo<SearchShortcutContextValue>(() => {
    return {
      register,
      focusActiveSearch,
      activeLabel,
    };
  }, [activeLabel, focusActiveSearch, register]);

  return <SearchShortcutContext.Provider value={value}>{children}</SearchShortcutContext.Provider>;
};

export const useSearchShortcut = (target: SearchTarget) => {
  const context = React.useContext(SearchShortcutContext);
  if (!context) throw new Error("useSearchShortcut must be used within SearchShortcutProvider");

  const { register } = context;
  const { active, id, label, onTrigger, priority, ref } = target;
  const stableTarget = React.useMemo(
    () => ({ active, id, label, onTrigger, priority, ref }),
    [active, id, label, onTrigger, priority, ref],
  );
  React.useEffect(() => register(stableTarget), [register, stableTarget]);
};

export const useSearchShortcutContext = () => {
  const context = React.useContext(SearchShortcutContext);
  if (!context) throw new Error("useSearchShortcutContext must be used within SearchShortcutProvider");
  return context;
};
