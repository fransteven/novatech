import { normalizeSerial } from "@/lib/serials";

export type ScanDecision =
  | { status: "accepted"; complete?: boolean }
  | { status: "rejected"; message: string };

export interface ProcessBatchSerialOptions {
  scannedValue: string;
  currentSerials: (string | undefined | null)[];
  targetQuantity: number;
  targetIndex?: number;
  /**
   * Additional set of serials already in other lines or persisted in DB
   * (e.g. `duplicateSerials` set from purchase form).
   */
  existingSerialsSet?: Set<string>;
}

export interface ProcessBatchSerialResult {
  decision: ScanDecision;
  nextSerials: string[];
  filledIndex: number;
  isComplete: boolean;
}

/**
 * Pure function to process a scanned serial into a batch array:
 * - Normalizes serial (trimmed, uppercase, no whitespace).
 * - Detects duplicates in current batch and optional external set.
 * - Fills targetIndex if specified, or the next empty slot.
 * - Determines if the required quantity is now fully satisfied.
 */
export function processBatchSerial({
  scannedValue,
  currentSerials,
  targetQuantity,
  targetIndex,
  existingSerialsSet,
}: ProcessBatchSerialOptions): ProcessBatchSerialResult {
  const normalized = normalizeSerial(scannedValue);

  // 1. Validate empty
  if (!normalized) {
    return {
      decision: { status: "rejected", message: "Serial vacío o inválido" },
      nextSerials: [...currentSerials].map((s) => s ?? ""),
      filledIndex: -1,
      isComplete: false,
    };
  }

  // Ensure working copy has at least targetQuantity slots
  const nextSerials = Array.from({ length: Math.max(targetQuantity, currentSerials.length) }, (_, i) =>
    currentSerials[i] ? normalizeSerial(currentSerials[i]!) : ""
  );

  // 2. Determine slot index
  let slotIndex = -1;
  if (targetIndex !== undefined && targetIndex >= 0 && targetIndex < targetQuantity) {
    slotIndex = targetIndex;
  } else {
    // Find first empty slot within targetQuantity
    slotIndex = nextSerials.slice(0, targetQuantity).findIndex((s) => !s || !s.trim());
    if (slotIndex === -1) {
      return {
        decision: { status: "rejected", message: "Lote completo, no hay más casillas disponibles" },
        nextSerials,
        filledIndex: -1,
        isComplete: true,
      };
    }
  }

  // 3. Check for duplicates (excluding the current slot being replaced)
  for (let i = 0; i < targetQuantity; i++) {
    if (i !== slotIndex && nextSerials[i] === normalized) {
      return {
        decision: { status: "rejected", message: `El serial "${normalized}" ya está en este lote (campo #${i + 1})` },
        nextSerials,
        filledIndex: -1,
        isComplete: false,
      };
    }
  }

  if (existingSerialsSet && existingSerialsSet.has(normalized)) {
    return {
      decision: { status: "rejected", message: `El serial "${normalized}" ya está registrado en la compra` },
      nextSerials,
      filledIndex: -1,
      isComplete: false,
    };
  }

  // 4. Fill slot
  nextSerials[slotIndex] = normalized;

  // 5. Check if all required slots are now filled
  const isComplete =
    nextSerials.slice(0, targetQuantity).filter((s) => Boolean(s && s.trim())).length === targetQuantity;

  return {
    decision: {
      status: "accepted",
      complete: isComplete,
    },
    nextSerials,
    filledIndex: slotIndex,
    isComplete,
  };
}
