import { Metadata } from "next";
import { getPurchasesAction } from "@/app/actions/purchase-actions";
import { PurchaseList } from "@/components/purchases/PurchaseList";
import { PurchaseDialog } from "@/components/purchases/PurchaseDialog";
import { getProvidersAction } from "@/app/actions/provider-actions";
import { getCashAccountsWithBalanceAction } from "@/app/actions/cash-actions";
import { getProductsAction } from "@/app/actions/product-actions";
import { ShoppingCart } from "lucide-react";

export const metadata: Metadata = {
  title: "Compras | NovaTech",
};

export default async function PurchasesPage() {
  const [purchasesRes, providersRes, cashAccountsRes, productsRes] = await Promise.all([
    getPurchasesAction(),
    getProvidersAction(),
    getCashAccountsWithBalanceAction(),
    getProductsAction(),
  ]);

  const purchases = purchasesRes.data ?? [];
  const providers = providersRes.data ?? [];
  const cashAccountsData = cashAccountsRes.data;
  const cashAccounts = cashAccountsData && !Array.isArray(cashAccountsData) ? cashAccountsData.accounts : [];
  const products = productsRes.data ?? [];

  return (
    <div className="flex-1 space-y-4 p-4 md:p-6 lg:p-8 pt-6 relative max-w-[1400px] mx-auto w-full">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-primary" />
            Compras
          </h2>
          <p className="text-[13px] text-muted-foreground mt-1">
            Gestiona las compras e ingresos de mercancía.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <PurchaseDialog
            providers={providers}
            cashAccounts={cashAccounts}
            products={products}
          />
        </div>
      </div>

      <div className="mt-4">
        <PurchaseList purchases={purchases} />
      </div>
    </div>
  );
}
