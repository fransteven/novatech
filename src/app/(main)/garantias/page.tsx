import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { WarrantySearch } from "@/components/garantias/warranty-search";
import { ClaimsTable } from "@/components/garantias/claims-table";
import { getRecentClaimsAction } from "@/app/actions/warranty-actions";
import { getSessionUser } from "@/lib/auth-guard";

export default async function GarantiasPage() {
  const [user, claimsResult] = await Promise.all([
    getSessionUser(),
    getRecentClaimsAction(),
  ]);
  const claims = claimsResult.success && claimsResult.data ? claimsResult.data : [];

  return (
    <div className="container mx-auto space-y-8 p-8">
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
    </div>
  );
}
