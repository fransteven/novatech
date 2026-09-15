import { getProductsAction } from "@/app/actions/product-actions";
import { CreateProductDialog } from "@/components/catalog/create-product-dialog";
import { ProductTable } from "@/components/catalog/product-table";
import { CreateCategoryDialog } from "@/components/catalog/create-category-dialog";
import { CatalogKpis } from "@/components/catalog/catalog-kpis";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";

export default async function CatalogPage() {
  const { data: products } = await getProductsAction();

  return (
    <PageShell width="standard" className="space-y-5">
      <PageHeader
        title="Catálogo"
        description="Gestiona los productos y categorías disponibles en la tienda."
        actions={
          <>
            <CreateCategoryDialog />
            <CreateProductDialog />
          </>
        }
      />
      <CatalogKpis products={products ?? []} />
      <ProductTable data={products ?? []} />
    </PageShell>
  );
}
