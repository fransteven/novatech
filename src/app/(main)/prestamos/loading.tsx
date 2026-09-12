import { Skeleton } from "@/components/ui/skeleton";

export default function PrestamosLoading() {
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-52" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-11 w-40 rounded-xl" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-5 rounded-md" />
            </div>
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-3 w-40" />
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <Skeleton className="h-11 w-full sm:w-80 rounded-xl" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20 rounded-xl" />
            <Skeleton className="h-9 w-20 rounded-xl" />
            <Skeleton className="h-9 w-20 rounded-xl" />
          </div>
        </div>

        <div className="rounded-xl border overflow-hidden bg-card">
          <div className="border-b bg-muted/40 p-4 flex gap-4">
            {[100, 150, 100, 80, 100, 100, 100].map((w, i) => (
              <Skeleton key={i} className="h-4" style={{ width: w }} />
            ))}
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-4 border-b last:border-0"
            >
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-9 w-24 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
