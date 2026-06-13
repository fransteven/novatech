/**
 * state-machine.ts — Máquina de estados del crédito/apartado.
 * Bloquea transiciones inválidas antes de cualquier operación.
 *
 * Estados:
 *   cotizacion → active → completed | cancelled | defaulted
 *
 * Terminales: completed, cancelled, defaulted (sin salida).
 */

export type LayawayStatus =
  | "cotizacion"
  | "active"
  | "completed"
  | "cancelled"
  | "defaulted";

export const VALID_TRANSITIONS: Record<LayawayStatus, LayawayStatus[]> = {
  cotizacion: ["active", "cancelled"],
  active: ["completed", "cancelled", "defaulted"],
  completed: [],
  cancelled: [],
  defaulted: [],
};

export function canTransition(from: LayawayStatus, to: LayawayStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: LayawayStatus, to: LayawayStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Transición inválida: ${from} → ${to}. ` +
        `Transiciones permitidas desde '${from}': [${(VALID_TRANSITIONS[from] ?? []).join(", ") || "ninguna"}]`
    );
  }
}
