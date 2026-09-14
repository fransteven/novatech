import { describe, expect, it } from "vitest";
import { isSearchShortcutEvent, resolveSearchTarget, type SearchPriority } from "@/providers/search-shortcut-provider";

type Candidate = { id: string; active?: boolean; priority?: SearchPriority; usable: boolean };
const keyEvent = (overrides: Partial<KeyboardEvent>): Pick<KeyboardEvent, "altKey" | "ctrlKey" | "isComposing" | "key" | "keyCode" | "metaKey" | "shiftKey"> => ({
  altKey: false, ctrlKey: false, isComposing: false, key: "k", keyCode: 0, metaKey: false, shiftKey: false,
  ...overrides,
});

describe("search shortcut resolution", () => {
  it("prioriza una búsqueda visible de overlay sobre la búsqueda de página", () => {
    const result = resolveSearchTarget<Candidate>([
      { id: "page", priority: "page", usable: true },
      { id: "overlay", priority: "overlay", usable: true },
    ], (candidate) => candidate.usable);
    expect(result?.id).toBe("overlay");
  });

  it("ignora destinos ocultos, deshabilitados o inactivos según el predicado", () => {
    const result = resolveSearchTarget<Candidate>([
      { id: "hidden-overlay", priority: "overlay", usable: false },
      { id: "inactive", priority: "overlay", active: false, usable: true },
      { id: "page", priority: "page", usable: true },
    ], (candidate) => candidate.usable);
    expect(result?.id).toBe("page");
  });

  it("reconoce Cmd/Ctrl+K y evita composición, Alt y Shift", () => {
    expect(isSearchShortcutEvent(keyEvent({ metaKey: true }))).toBe(true);
    expect(isSearchShortcutEvent(keyEvent({ ctrlKey: true }))).toBe(true);
    expect(isSearchShortcutEvent(keyEvent({ metaKey: true, altKey: true }))).toBe(false);
    expect(isSearchShortcutEvent(keyEvent({ ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(isSearchShortcutEvent(keyEvent({ ctrlKey: true, isComposing: true }))).toBe(false);
  });
});
