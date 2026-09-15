import { getImportCostsAction } from "@/app/actions/import-cost-actions";
import { CreateImportCostDialog } from "@/components/import-costs/create-import-cost-dialog";
import { ImportCostsKpis } from "@/components/import-costs/import-costs-kpis";
import { ImportCostsTable } from "@/components/import-costs/import-costs-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { AlertCircle, PackageSearch } from "lucide-react";

export default async function ImportCostsPage() {
  const { success, data, error } = await getImportCostsAction();

  if (!success || !data) {
    return (
      <PageShell width="standard" className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">
          Costeo de Importaciones
        </h1>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Error al cargar los costeos: {error}
          </AlertDescription>
        </Alert>
      </PageShell>
    );
  }

  const { importCosts, stats, products } = data;

  const productOptions = products.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    attributes: p.attributes as Record<string, string> | null,
    categoryTemplate: p.categoryTemplate as Array<{
      key: string;
      label: string;
      type: "select" | "text";
      options?: string[];
    }> | null,
  }));

  return (
    <PageShell width="standard" className="space-y-6">
      <PageHeader
        title="Costeo de Importaciones"
        description="Registra y analiza el costo real de traer equipos desde Estados Unidos."
        icon={PackageSearch}
        actions={<CreateImportCostDialog products={productOptions} />}
      />

      <ImportCostsKpis stats={stats} />

      <ImportCostsTable
        data={importCosts.map((r) => ({
          ...r,
          specs: (r.specs ?? null) as Record<string, string> | null,
        }))}
      />
    </PageShell>
  );
}
