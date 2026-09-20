import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ITEM_CONDITION_LABELS,
  type ItemCondition,
} from "@/lib/validators/inventory-validator";

const CONDITION_CLASS: Record<ItemCondition, string> = {
  new: "",
  used: "tf-badge-low",
  refurbished: "tf-badge-normal",
};

interface ConditionBadgeProps {
  condition: string | null | undefined;
  /** Meses de garantía propios de la unidad; se muestran junto a la condición. */
  warrantyMonths?: number | null;
  /** Oculta el badge cuando la unidad es nueva (listas densas). */
  hideNew?: boolean;
  className?: string;
}

/**
 * Condición de la unidad física (nuevo / segunda / reacondicionado). Es el
 * dato que define precio y cobertura, así que se pinta en inventario, POS,
 * compras y garantías con el mismo lenguaje visual.
 */
export function ConditionBadge({
  condition,
  warrantyMonths,
  hideNew = false,
  className,
}: ConditionBadgeProps) {
  const key = (condition ?? "new") as ItemCondition;
  const label = ITEM_CONDITION_LABELS[key];

  if (!label) return null;
  if (key === "new" && hideNew) return null;

  return (
    <Badge variant="outline" className={cn(CONDITION_CLASS[key], className)}>
      {label}
      {warrantyMonths ? ` · ${warrantyMonths}m` : ""}
    </Badge>
  );
}
