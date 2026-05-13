import { InventoryKPIs } from "@/components/inventory/inventory-kpis";
import { StockTable } from "@/components/inventory/stock-table";
import { AddStockSheet } from "@/components/inventory/add-stock-sheet";
import { InventorySearch } from "@/components/inventory/inventory-search";
import { PageHeader } from "@/components/ui/page-header";
import { getProducts } from "@/services/product-service";
import {
  getInventoryStats,
  getStockSummary,
  searchInventoryStock,
} from "@/services/inventory-service";
import { revalidatePath } from "next/cache";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InventoryPageProps {
  searchParams: Promise<{ query?: string }>;
}

async function syncInventory() {
  "use server";
  revalidatePath("/inventory");
}

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const { query } = await searchParams;

  const products = await getProducts();
  const stats = await getInventoryStats();
  const stock = query
    ? await searchInventoryStock(query)
    : await getStockSummary();

  return (
    <div className="max-w-[1480px] mx-auto px-4 md:px-8 py-7 pb-20">
      <PageHeader
        title="Gestión de Bodega"
        description="Control de existencias y entradas de mercancía. Monitorea niveles, registra ingresos y mantén tu inventario actualizado en tiempo real."
        actions={
          <>
            <form action={syncInventory}>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="h-[38px] px-[14px] text-[13.5px] font-medium"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-2" />
                Sincronizar
              </Button>
            </form>
            <AddStockSheet products={products} />
          </>
        }
      />

      <InventoryKPIs stats={stats} />

      <div className="mt-6">
        <StockTable
          stock={stock}
          searchSlot={<InventorySearch />}
        />
      </div>
    </div>
  );
}
