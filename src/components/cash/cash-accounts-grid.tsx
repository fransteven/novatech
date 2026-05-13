import { Banknote, Landmark, Smartphone, CreditCard } from "lucide-react";
import { CashAccountWithBalance } from "@/services/cash-service";
import { formatCurrency } from "@/lib/formatters";

type AccountType = "cash" | "bank" | "wallet" | "card_processor";

const typeConfig: Record<
  AccountType,
  { icon: React.ElementType; iconBg: string; iconFg: string; label: string }
> = {
  cash: {
    icon: Banknote,
    iconBg: "oklch(0.62 0.15 150 / 0.15)",
    iconFg: "oklch(0.62 0.15 150)",
    label: "Efectivo",
  },
  bank: {
    icon: Landmark,
    iconBg: "oklch(0.58 0.19 265 / 0.15)",
    iconFg: "oklch(0.58 0.19 265)",
    label: "Banco",
  },
  wallet: {
    icon: Smartphone,
    iconBg: "oklch(0.65 0.16 200 / 0.15)",
    iconFg: "oklch(0.65 0.16 200)",
    label: "Billetera",
  },
  card_processor: {
    icon: CreditCard,
    iconBg: "oklch(0.72 0.15 70 / 0.15)",
    iconFg: "oklch(0.72 0.15 70)",
    label: "Datáfono",
  },
};

const fallbackConfig = typeConfig.cash;

export function CashAccountsGrid({
  accounts,
}: {
  accounts: CashAccountWithBalance[];
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {accounts.map((account) => {
        const config =
          typeConfig[account.type as AccountType] ?? fallbackConfig;
        const Icon = config.icon;

        return (
          <div
            key={account.id}
            className="relative overflow-hidden bg-card border border-border rounded-[14px] p-5 transition-all duration-200 hover:-translate-y-0.5"
            style={{ boxShadow: "var(--tf-shadow-sm)" }}
          >
            {/* Top row: icon chip + type badge */}
            <div className="flex items-center justify-between">
              <div
                className="w-9 h-9 rounded-[9px] flex items-center justify-center flex-shrink-0"
                style={{
                  background: config.iconBg,
                }}
              >
                <Icon
                  className="h-4 w-4"
                  style={{ color: config.iconFg }}
                />
              </div>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
                style={{
                  background: config.iconBg,
                  color: config.iconFg,
                }}
              >
                {config.label}
              </span>
            </div>

            {/* Account name */}
            <p className="text-[15px] font-semibold mt-3 text-foreground truncate">
              {account.name}
            </p>

            {/* Balance */}
            <p
              className="text-[26px] font-bold tabular-nums mt-1 leading-tight"
              style={{
                color:
                  account.balance >= 0
                    ? "var(--tf-green)"
                    : "var(--tf-red)",
              }}
            >
              {formatCurrency(account.balance)}
            </p>

            {/* Subline */}
            <p className="text-[11.5px] text-muted-foreground mt-1.5">
              {account.currency} · Saldo inicial:{" "}
              {formatCurrency(parseFloat(account.openingBalance))}
            </p>
          </div>
        );
      })}
    </div>
  );
}
