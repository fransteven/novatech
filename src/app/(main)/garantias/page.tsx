import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { WarrantySearch } from "@/components/garantias/warranty-search";
import { ClaimsTable } from "@/components/garantias/claims-table";
import { getRecentClaimsAction } from "@/app/actions/warranty-actions";
import { getSessionUser } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export default async function GarantiasPage() {
  const [user, claimsResult] = await Promise.all([
    getSessionUser(),
    getRecentClaimsAction(),
  ]);
  const claims = claimsResult.success && claimsResult.data ? claimsResult.data : [];

  return (
    <PageShell width="standard" className="space-y-6">
      <PageHeader
        title="Garantías"
        description="Consulta la cobertura de cualquier equipo vendido por IMEI, cliente, producto o N° de venta, y registra sus reclamos."
        icon={ShieldCheck}
      />

      <WarrantySearch canAdjust={user?.role === "admin"} />

      <div>
        <h2 className="text-[15px] font-semibold mb-3">Reclamos Recientes</h2>
        <ClaimsTable claims={claims} />
      </div>
    </PageShell>
  );
}
