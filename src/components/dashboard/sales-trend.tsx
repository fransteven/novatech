import { format } from "date-fns";
import { es } from "date-fns/locale";

import { formatCurrency } from "@/lib/formatters";
import type { DashboardSalesTrendPoint } from "@/services/dashboard-service";

interface SalesTrendProps {
  points: DashboardSalesTrendPoint[];
}

const SalesTrend = ({ points }: SalesTrendProps) => {
  const max = Math.max(1, ...points.map((point) => point.total));
  const width = 720;
  const height = 218;
  const padding = 12;
  const positions = points.map((point, index) => {
    const x = padding + (index / Math.max(1, points.length - 1)) * (width - padding * 2);
    const y = height - padding - (point.total / max) * (height - padding * 2);
    return { point, x, y };
  });
  const coordinates = positions.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const total = points.reduce((sum, point) => sum + point.total, 0);
  const firstLabel = points[0] ? format(new Date(`${points[0].date}T12:00:00`), "d MMM", { locale: es }) : "";
  const lastPoint = points[points.length - 1];
  const lastLabel = lastPoint ? format(new Date(`${lastPoint.date}T12:00:00`), "d MMM", { locale: es }) : "";
  const summary = points.length
    ? `Tendencia de ${points.length} días, desde ${firstLabel} hasta ${lastLabel}. Ventas completadas: ${formatCurrency(total)}.`
    : "No hay datos de ventas para el periodo seleccionado.";

  return (
    <figure className="mt-4" aria-labelledby="sales-trend-caption" aria-describedby="sales-trend-summary">
      <div className="relative h-[218px] overflow-hidden border-y border-border bg-[var(--tf-aluminum-soft)] px-2 py-2">
        <div aria-hidden="true" className="absolute inset-x-0 top-1/3 border-t border-border/70" />
        <div aria-hidden="true" className="absolute inset-x-0 top-2/3 border-t border-border/70" />
        <svg aria-hidden="true" className="relative h-full w-full" focusable="false" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <polyline fill="none" points={coordinates} stroke="var(--tf-accent)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          {positions.map(({ point, x, y }) => point.total > 0 ? <circle cx={x} cy={y} fill="var(--tf-accent)" key={point.date} r="2.5" vectorEffect="non-scaling-stroke" /> : null)}
        </svg>
      </div>
      <p id="sales-trend-summary" className="sr-only">{summary}</p>
      <figcaption id="sales-trend-caption" className="mono mt-2 flex items-center justify-between text-[10px] font-medium tracking-[0.06em] text-muted-foreground">
        <span>{firstLabel}</span>
        <span className="text-[color:var(--tf-fg-muted)]">{points.length} DÍAS · {formatCurrency(total)}</span>
        <span>{lastLabel}</span>
      </figcaption>
    </figure>
  );
};

export { SalesTrend };
