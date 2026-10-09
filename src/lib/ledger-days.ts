/**
 * Agrupación por día para los listados tipo libro (ventas, gastos).
 *
 * Se formatea siempre en America/Bogota con Intl: el render del servidor corre
 * en UTC y, con date-fns, una venta de las 8 p. m. caía en el día siguiente y
 * no coincidía con la hidratación del cliente.
 */
const TIME_ZONE = "America/Bogota";

// Sólo se piden partes numéricas a Intl: los nombres y separadores que arma
// ICU ("p. m." con espacio fino, "oct." con punto) cambian entre Node y el
// navegador y rompían la hidratación.
const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const bogotaParts = (date: Date | string) => {
  const parts: Record<string, number> = {};
  for (const part of partsFormatter.formatToParts(new Date(date))) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour % 24,
    minute: parts.minute,
  };
};

const pad = (value: number) => String(value).padStart(2, "0");

/** `yyyy-mm-dd` del día calendario en Bogotá. */
export const dayKey = (date: Date | string) => {
  const { year, month, day } = bogotaParts(date);
  return `${year}-${pad(month)}-${pad(day)}`;
};

const shiftKey = (key: string, days: number) => {
  const [y, m, d] = key.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return shifted.toISOString().slice(0, 10);
};

export interface DayLabel {
  /** "Hoy", "Ayer" o null cuando no es reciente. */
  relative: string | null;
  /** "miércoles 7 oct", con el año si no es el año en curso. */
  date: string;
}

export const dayLabel = (date: Date | string, now: Date = new Date()): DayLabel => {
  const { year, month, day } = bogotaParts(date);
  const key = `${year}-${pad(month)}-${pad(day)}`;
  const todayKey = dayKey(now);
  const relative =
    key === todayKey ? "Hoy" : key === shiftKey(todayKey, -1) ? "Ayer" : null;
  // El día de la semana sale de la fecha calendario, no del instante.
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  const sameYear = key.slice(0, 4) === todayKey.slice(0, 4);
  return {
    relative,
    date: `${weekday} ${day} ${MONTHS[month - 1]}${sameYear ? "" : ` ${year}`}`,
  };
};

/** "4:32 p. m." en hora de Bogotá. */
export const timeLabel = (date: Date | string) => {
  const { hour, minute } = bogotaParts(date);
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${pad(minute)} ${hour < 12 ? "a. m." : "p. m."}`;
};

export interface DayGroup<T> {
  key: string;
  date: Date;
  items: T[];
}

/** Agrupa conservando el orden recibido (los listados ya llegan por fecha desc). */
export const groupByDay = <T,>(
  items: T[],
  getDate: (item: T) => Date | string,
): DayGroup<T>[] => {
  const groups: DayGroup<T>[] = [];
  for (const item of items) {
    const date = new Date(getDate(item));
    const key = dayKey(date);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, date, items: [item] });
  }
  return groups;
};

/** Conteo y suma por día sobre TODO el conjunto filtrado, no sólo la página. */
export const dayTotals = <T,>(
  items: T[],
  getDate: (item: T) => Date | string,
  getAmount: (item: T) => number,
) => {
  const totals = new Map<string, { count: number; total: number }>();
  for (const item of items) {
    const key = dayKey(getDate(item));
    const current = totals.get(key) ?? { count: 0, total: 0 };
    current.count += 1;
    current.total += getAmount(item);
    totals.set(key, current);
  }
  return totals;
};
