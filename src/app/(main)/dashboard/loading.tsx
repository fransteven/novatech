import { PageShell } from "@/components/ui/page-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <PageShell className="space-y-5" aria-label="Cargando dashboard" role="status">
      <div className="space-y-2 pl-4"><Skeleton className="h-3 w-20" /><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-[26rem] max-w-full" /></div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <div className="space-y-4 rounded-[10px] border border-border bg-card p-5" key={index}><Skeleton className="h-4 w-28" /><Skeleton className="h-8 w-36" /><Skeleton className="h-3 w-40" /></div>)}
      </div>
      <div className="grid gap-3 xl:grid-cols-5">
        <div className="space-y-5 rounded-[10px] border border-border bg-card p-5 xl:col-span-3"><Skeleton className="h-5 w-36" /><Skeleton className="h-3 w-56" /><Skeleton className="h-[218px] w-full" /></div>
        <div className="space-y-4 rounded-[10px] border border-border bg-card p-5 xl:col-span-2">{Array.from({ length: 5 }).map((_, index) => <Skeleton className="h-12 w-full" key={index} />)}</div>
      </div>
    </PageShell>
  );
}
