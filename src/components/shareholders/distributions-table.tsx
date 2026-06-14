"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { markDistributionItemPaidAction } from "@/app/actions/shareholder-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const fmt = (amount: number | string) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(Number(amount));

interface DistributionItem {
  id: string;
  shareholderId: string;
  ownershipPct: string | number;
  amount: string | number;
  paidAt: Date | null;
  shareholderName: string;
}

interface Distribution {
  id: string;
  periodYear: number;
  totalNetProfit: string | number;
  status: string;
  declaredAt: Date;
  paidAt: Date | null;
  notes: string | null;
  items: DistributionItem[];
}

interface DistributionsTableProps {
  distributions: Distribution[];
}

function DistributionRow({ dist }: { dist: Distribution }) {
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleMarkPaid(itemId: string) {
    startTransition(async () => {
      const result = await markDistributionItemPaidAction(itemId);
      if (result.success) {
        toast.success("Pago registrado");
      } else {
        toast.error("Error", { description: result.error });
      }
    });
  }

  return (
    <>
      <tr
        className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-3 font-semibold text-[13px]">{dist.periodYear}</td>
        <td className="px-4 py-3 text-right text-[13px]">{fmt(dist.totalNetProfit)}</td>
        <td className="px-4 py-3 text-right text-[13px] text-green-600 font-medium">
          {fmt(Number(dist.totalNetProfit) / 2)}
        </td>
        <td className="px-4 py-3 text-[13px] text-muted-foreground">
          {new Date(dist.declaredAt).toLocaleDateString("es-CO")}
        </td>
        <td className="px-4 py-3">
          <Badge
            variant={dist.status === "paid" ? "default" : "secondary"}
            className={dist.status === "paid" ? "bg-green-600 text-white" : ""}
          >
            {dist.status === "paid" ? "Pagado" : "Pendiente"}
          </Badge>
        </td>
        <td className="px-4 py-3 text-right">
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground inline" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground inline" />
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-muted/20">
          <td colSpan={6} className="px-6 py-4">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Detalle por accionista
            </p>
            <div className="space-y-2">
              {dist.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between bg-card rounded-[8px] border border-border px-4 py-3"
                >
                  <div>
                    <p className="text-[13px] font-medium">{item.shareholderName}</p>
                    <p className="text-[11px] text-muted-foreground">{Number(item.ownershipPct)}%</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[14px] font-semibold text-green-600">
                      {fmt(item.amount)}
                    </span>
                    {item.paidAt ? (
                      <Badge className="bg-green-600 text-white gap-1">
                        <Check className="h-3 w-3" />
                        Pagado
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkPaid(item.id);
                        }}
                      >
                        Marcar pagado
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {dist.notes && (
              <p className="text-[12px] text-muted-foreground mt-3">
                Notas: {dist.notes}
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export function DistributionsTable({ distributions }: DistributionsTableProps) {
  if (distributions.length === 0) {
    return (
      <div className="rounded-[12px] border border-border p-8 text-center text-muted-foreground text-[13px]">
        No hay repartos registrados aún.
      </div>
    );
  }

  return (
    <div className="rounded-[12px] border border-border overflow-x-auto">
      <table className="w-full text-sm min-w-[540px]">
        <thead className="bg-muted/50">
          <tr className="border-b border-border">
            <th className="px-4 py-3 text-left font-semibold text-[12px] uppercase tracking-wide text-muted-foreground">
              Año
            </th>
            <th className="px-4 py-3 text-right font-semibold text-[12px] uppercase tracking-wide text-muted-foreground">
              Utilidad Neta
            </th>
            <th className="px-4 py-3 text-right font-semibold text-[12px] uppercase tracking-wide text-muted-foreground">
              Por accionista (50%)
            </th>
            <th className="px-4 py-3 text-left font-semibold text-[12px] uppercase tracking-wide text-muted-foreground">
              Declarado
            </th>
            <th className="px-4 py-3 text-left font-semibold text-[12px] uppercase tracking-wide text-muted-foreground">
              Estado
            </th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {distributions.map((dist) => (
            <DistributionRow key={dist.id} dist={dist} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
