import { Skeleton } from "@/components/ui/skeleton";

interface TableSkeletonProps {
  columns?: number;
  rows?: number;
}

const TableSkeleton = ({ columns = 5, rows = 7 }: TableSkeletonProps) => (
  <div className="overflow-hidden rounded-[10px] border border-border bg-card" aria-label="Cargando tabla" role="status">
    <div className="flex h-11 items-center gap-4 border-b border-border bg-muted/60 px-4">
      {Array.from({ length: columns }).map((_, index) => <Skeleton className="h-2.5 flex-1" key={index} />)}
    </div>
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div className="flex min-h-14 items-center gap-4 border-b border-border px-4 last:border-b-0" key={rowIndex}>
        {Array.from({ length: columns }).map((_, columnIndex) => <Skeleton className="h-3 flex-1" key={columnIndex} />)}
      </div>
    ))}
  </div>
);

export { TableSkeleton };
