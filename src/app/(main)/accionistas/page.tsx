import {
  getShareholdersAction,
  getDistributionsAction,
} from "@/app/actions/shareholder-actions";
import { DistributionDialog } from "@/components/shareholders/distribution-dialog";
import { DistributionsTable } from "@/components/shareholders/distributions-table";
import { PageHeader } from "@/components/ui/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Users } from "lucide-react";

export default async function AccionistasPage() {
  const [shareholdersResult, distributionsResult] = await Promise.all([
    getShareholdersAction(),
    getDistributionsAction(),
  ]);

  if (!shareholdersResult.success || !distributionsResult.success) {
    return (
      <div className="container mx-auto space-y-8 p-8">
        <h1 className="text-3xl font-bold tracking-tight">Accionistas</h1>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Error al cargar los datos.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const shareholders = shareholdersResult.data ?? [];
  const distributions = distributionsResult.data ?? [];

  return (
    <div className="container mx-auto space-y-8 p-8">
      <PageHeader
        title="Accionistas"
        description="Gestión de repartos anuales 50/50 entre los socios de NovaTech."
        icon={Users}
        actions={<DistributionDialog />}
      />

      {/* Shareholder cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {shareholders.map((s) => (
          <div
            key={s.id}
            className="rounded-[12px] border border-border bg-card p-5 flex items-center gap-4"
          >
            <div
              className="w-10 h-10 rounded-full grid place-items-center text-white font-bold text-[15px] shrink-0"
              style={{ background: "linear-gradient(135deg, var(--tf-accent), oklch(0.5 0.2 295))" }}
            >
              {s.fullName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold truncate">{s.fullName}</p>
              {s.email && (
                <p className="text-[12px] text-muted-foreground truncate">{s.email}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-[20px] font-bold">{Number(s.ownershipPct)}%</p>
              <p className="text-[11px] text-muted-foreground">participación</p>
            </div>
          </div>
        ))}
      </div>

      {/* Distributions history */}
      <div>
        <h2 className="text-[15px] font-semibold mb-3">Historial de repartos</h2>
        <DistributionsTable distributions={distributions as Parameters<typeof DistributionsTable>[0]["distributions"]} />
      </div>
    </div>
  );
}
