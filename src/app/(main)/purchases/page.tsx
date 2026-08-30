import { Metadata } from "next";
import { ShoppingCart, Wallet, CalendarDays, Receipt } from "lucide-react";

import {
  getPurchasesAction,
  getPurchaseStatsAction,
} from "@/app/actions/purchase-actions";
import { getProvidersAction } from "@/app/actions/provider-actions";
import { getCashAccountsWithBalanceAction } from "@/app/actions/cash-actions";
import { getProductsAction } from "@/app/actions/product-actions";
import { PurchaseList } from "@/components/purchases/purchase-list";
import { PurchaseSheet } from "@/components/purchases/purchase-sheet";
import { PurchaseFilters } from "@/components/purchases/purchase-filters";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { formatCurrency } from "@/lib/formatters";

export const metadata: Metadata = {
  title: "Compras | NovaTech",
};

interface PurchasesPageProps {
  searchParams: Promise<{
    search?: string;
    providerId?: string;
    paymentStatus?: string;
    from?: string;
    to?: string;
  }>;
}

export default async function PurchasesPage({
  searchParams,
}: PurchasesPageProps) {
  const params = await searchParams;

  const filters = {
    search: params.search || undefined,
    providerId: params.providerId || undefined,
    paymentStatus: params.paymentStatus || undefined,
    from: params.from ? new Date(`${params.from}T00:00:00`) : undefined,
    to: params.to ? new Date(`${params.to}T23:59:59`) : undefined,
  };

  const [purchasesRes, statsRes, providersRes, cashAccountsRes, productsRes] =
    await Promise.all([
      getPurchasesAction(filters),
      getPurchaseStatsAction(),
      getProvidersAction(),
      getCashAccountsWithBalanceAction(),
      getProductsAction(),
    ]);

  const purchases = purchasesRes.data ?? [];
  const stats = statsRes.data;
  const providers = providersRes.data ?? [];
  const cashAccountsData = cashAccountsRes.data;
  const cashAccounts =
    cashAccountsData && !Array.isArray(cashAccountsData)
      ? cashAccountsData.accounts
      : [];
  const products = productsRes.data ?? [];

  return (
    <div className="max-w-[1480px] mx-auto px-4 md:px-8 py-7 pb-20">
      <PageHeader
        title="Compras"
        description="Ingreso de mercancía al inventario con su costo real: producto, costos adicionales prorrateados y el pago (o el saldo) al proveedor."
        icon={ShoppingCart}
        actions={
          <PurchaseSheet
            providers={providers}
            cashAccounts={cashAccounts}
            products={products}
          />
        }
      />

      {stats && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <KpiCard
            icon={Receipt}
            title="Total comprado"
            value={formatCurrency(stats.totalAmount)}
            description={`${stats.count} compra(s) registradas`}
          />
          <KpiCard
            icon={CalendarDays}
            title="Compras del mes"
            value={formatCurrency(stats.monthAmount)}
            description={`${stats.monthCount} compra(s) este mes`}
          />
          <KpiCard
            icon={Wallet}
            title="Saldo a proveedores"
            value={formatCurrency(stats.pendingAmount)}
            description={`${stats.pendingCount} compra(s) con saldo`}
            valueClassName={
              stats.pendingAmount > 0
                ? "text-amber-600 dark:text-amber-400"
                : undefined
            }
          />
          <KpiCard
            icon={ShoppingCart}
            title="Proveedores"
            value={providers.length}
            description="Registrados en el sistema"
          />
        </div>
      )}

      <PurchaseFilters providers={providers} />

      <PurchaseList purchases={purchases} cashAccounts={cashAccounts} />
    </div>
  );
}
