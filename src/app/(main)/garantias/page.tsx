import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { WarrantySearch } from "@/components/garantias/warranty-search";
import { ClaimsTable } from "@/components/garantias/claims-table";
import { getRecentClaimsAction } from "@/app/actions/warranty-actions";

export default async function GarantiasPage() {
  const claimsResult = await getRecentClaimsAction();
  const claims = claimsResult.success && claimsResult.data ? claimsResult.data : [];

  return (
    <div className="container mx-auto space-y-8 p-8">
      <PageHeader
        title="Garantías"
        description="Valida un equipo por serial/IMEI antes de aceptar un reclamo, y registra su seguimiento."
        icon={ShieldCheck}
      />

      <WarrantySearch />

      <div>
        <h2 className="text-[15px] font-semibold mb-3">Reclamos Recientes</h2>
        <ClaimsTable claims={claims} />
      </div>
    </div>
  );
}
