/**
 * Estado visual de una cuota de un cronograma de pagos.
 *
 * Deriva un único estado a partir del estado persistido (`pendiente` |
 * `pagada` | `vencida`), del monto abonado y de la fecha de vencimiento, para
 * que la UI pueda pintar cada cuota con un color que se lea de un vistazo.
 */
export type InstallmentVisualState =
  | "pagada"
  | "parcial"
  | "vencida"
  | "por_vencer"
  | "pendiente";

export interface InstallmentVisual {
  state: InstallmentVisualState;
  /** Texto corto para el badge. */
  label: string;
  /** Detalle temporal ("hace 4 días", "vence hoy"), vacío si no aplica. */
  hint: string;
  /** Días hasta el vencimiento (negativo = vencida). */
  daysToDue: number;
  badgeClass: string;
  rowClass: string;
  accentClass: string;
  /** Porcentaje abonado de la cuota (0-100). */
  progress: number;
}

/** Ventana en días dentro de la cual una cuota pendiente se marca "por vencer". */
export const DUE_SOON_DAYS = 7;

export const INSTALLMENT_STATE_STYLES: Record<
  InstallmentVisualState,
  { badgeClass: string; rowClass: string; accentClass: string }
> = {
  pagada: {
    badgeClass:
      "bg-emerald-100 text-emerald-700 border-emerald-500/30 dark:bg-emerald-900/35 dark:text-emerald-300",
    rowClass: "bg-emerald-50/60 dark:bg-emerald-950/15",
    accentClass: "bg-emerald-500",
  },
  parcial: {
    badgeClass:
      "bg-amber-100 text-amber-700 border-amber-500/30 dark:bg-amber-900/35 dark:text-amber-300",
    rowClass: "bg-amber-50/60 dark:bg-amber-950/15",
    accentClass: "bg-amber-500",
  },
  vencida: {
    badgeClass:
      "bg-rose-100 text-rose-700 border-rose-500/30 dark:bg-rose-900/35 dark:text-rose-300",
    rowClass: "bg-rose-50/70 dark:bg-rose-950/20",
    accentClass: "bg-rose-500",
  },
  por_vencer: {
    badgeClass:
      "bg-sky-100 text-sky-700 border-sky-500/30 dark:bg-sky-900/35 dark:text-sky-300",
    rowClass: "bg-sky-50/60 dark:bg-sky-950/15",
    accentClass: "bg-sky-500",
  },
  pendiente: {
    badgeClass:
      "bg-muted text-muted-foreground border-border dark:bg-muted/60",
    rowClass: "",
    accentClass: "bg-border",
  },
};

const DAY_MS = 86_400_000;

/** Diferencia en días naturales entre dos fechas (ignora la hora). */
function diffInDays(due: Date, now: Date): number {
  const a = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a - b) / DAY_MS);
}

function describeDays(days: number): string {
  if (days < 0) {
    const late = Math.abs(days);
    return late === 1 ? "hace 1 día" : `hace ${late} días`;
  }
  if (days === 0) return "vence hoy";
  if (days === 1) return "vence mañana";
  return `en ${days} días`;
}

export interface InstallmentInput {
  status: string;
  dueDate: string | Date;
  totalAmount: string | number;
  paidAmount?: string | number | null;
  now?: Date;
}

export function getInstallmentVisual({
  status,
  dueDate,
  totalAmount,
  paidAmount,
  now = new Date(),
}: InstallmentInput): InstallmentVisual {
  const total = Number(totalAmount) || 0;
  const paid = Number(paidAmount ?? 0) || 0;
  const due = dueDate instanceof Date ? dueDate : new Date(dueDate);
  const daysToDue = Number.isNaN(due.getTime()) ? 0 : diffInDays(due, now);
  const progress =
    total > 0 ? Math.min(100, Math.max(0, Math.round((paid / total) * 100))) : 0;

  const isPaid = status === "pagada" || (total > 0 && paid >= total);
  const isOverdue = !isPaid && (status === "vencida" || daysToDue < 0);
  const hasPartial = !isPaid && paid > 0;

  let state: InstallmentVisualState;
  let label: string;

  if (isPaid) {
    state = "pagada";
    label = "Pagada";
  } else if (isOverdue) {
    state = "vencida";
    label = hasPartial ? "Vencida · abonada" : "Vencida";
  } else if (hasPartial) {
    state = "parcial";
    label = `Abonada ${progress}%`;
  } else if (daysToDue <= DUE_SOON_DAYS) {
    state = "por_vencer";
    label = daysToDue === 0 ? "Vence hoy" : "Por vencer";
  } else {
    state = "pendiente";
    label = "Pendiente";
  }

  return {
    state,
    label,
    hint: isPaid ? "" : describeDays(daysToDue),
    daysToDue,
    progress,
    ...INSTALLMENT_STATE_STYLES[state],
  };
}
