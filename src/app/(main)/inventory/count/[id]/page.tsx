import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { Button } from "@/components/ui/button";
import { CountWorkspace } from "@/components/stock-count/count-workspace";
import { getCountWithLines } from "@/services/stock-count-service";
import { getCategories } from "@/services/category-service";
import { getProducts } from "@/services/product-service";
import { isCategoryTemplate } from "@/lib/validators/category-validator";

export const metadata: Metadata = { title: "Conteo" };

interface CountPageProps {
  params: Promise<{ id: string }>;
}

const UUID_RE = /^[0-9a-f-]{36}$/i;

export default async function CountPage({ params }: CountPageProps) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const [count, categories, products] = await Promise.all([
    getCountWithLines(id),
    getCategories(),
    getProducts(),
  ]);
  if (!count) notFound();

  return (
    <PageShell width="standard" className="space-y-4">
      <PageHeader
        eyebrow="TOMA DE INVENTARIO"
        title={count.name}
        actions={
          <Button asChild variant="outline" size="sm" className="h-[38px]">
            <Link href="/inventory/count">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Conteos
            </Link>
          </Button>
        }
      />
      <CountWorkspace
        count={count}
        categories={categories
          .map((category) => ({
            id: category.id,
            name: category.name,
            template: isCategoryTemplate(category.template) ? category.template : [],
          }))
          .sort((a, b) => a.name.localeCompare(b.name, "es"))}
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
          sku: product.sku,
          isSerialized: product.isSerialized,
          price: product.price,
          attributes: product.attributes,
          categoryName: product.categoryName,
          stock: product.stock,
          barcodes: product.barcodes,
        }))}
      />
    </PageShell>
  );
}
