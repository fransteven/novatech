"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Eye, PlusCircle, X } from "lucide-react";
import { StageBadge } from "./stage-badge";
import { LeadDetailsDialog } from "./lead-details-dialog";
import { CreateLeadDialog } from "./create-lead-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/formatters";
import { useRouter } from "next/navigation";

type Lead = {
  id: string;
  prospectName: string;
  prospectPhone: string;
  productDescription: string;
  costPrice: number;
  salePrice: number;
  interestRate: number;
  termMonths: number;
  stage: string;
  lostReason?: string | null;
  daysSinceContact: number;
  notes?: string | null;
  margin: number;
  layawayId?: string | null;
  customerName?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

interface LeadsTableProps {
  data: Lead[];
}

const STAGE_FILTER_OPTIONS = [
  { value: "all", label: "Todas las etapas" },
  { value: "nuevo", label: "Nuevo" },
  { value: "contactado", label: "Contactado" },
  { value: "negociando", label: "Negociando" },
  { value: "ganado", label: "Ganado" },
  { value: "perdido", label: "Perdido" },
];

export function LeadsTable({ data }: LeadsTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data.filter((l) => {
      const matchSearch =
        !q ||
        l.prospectName.toLowerCase().includes(q) ||
        l.prospectPhone.includes(q) ||
        l.productDescription.toLowerCase().includes(q);
      const matchStage = stageFilter === "all" || l.stage === stageFilter;
      return matchSearch && matchStage;
    });
  }, [data, search, stageFilter]);

  const handleViewDetail = (lead: Lead) => {
    setSelectedLead(lead);
    setDetailOpen(true);
  };

  const handleUpdated = () => {
    router.refresh();
  };

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, teléfono o producto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-8"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {STAGE_FILTER_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={stageFilter === opt.value ? "default" : "outline"}
              size="sm"
              onClick={() => setStageFilter(opt.value)}
              className="text-xs h-8"
            >
              {opt.label}
            </Button>
          ))}
        </div>

        <Button
          size="sm"
          className="ml-auto shrink-0"
          onClick={() => setCreateOpen(true)}
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          Nuevo lead
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          headline={data.length === 0 ? "No hay leads registrados" : "Sin resultados"}
          description={
            data.length === 0
              ? "Crea el primer lead para empezar a trackear prospectos."
              : "Intenta ajustar los filtros."
          }
          action={
            data.length === 0
              ? { label: "Crear primer lead", onClick: () => setCreateOpen(true) }
              : undefined
          }
        />
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prospecto</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead className="text-right">Precio venta</TableHead>
                <TableHead className="text-right">Margen</TableHead>
                <TableHead className="text-center">Sin contacto</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((lead) => (
                <TableRow key={lead.id} className="group">
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{lead.prospectName}</p>
                      <p className="text-xs text-muted-foreground">
                        {lead.prospectPhone}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{lead.productDescription}</TableCell>
                  <TableCell>
                    <StageBadge stage={lead.stage} />
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium text-primary">
                    {formatCurrency(lead.salePrice)}
                  </TableCell>
                  <TableCell className="text-right text-sm text-green-600 dark:text-green-400">
                    {formatCurrency(lead.margin)}
                  </TableCell>
                  <TableCell className="text-center">
                    {["ganado", "perdido"].includes(lead.stage) ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <Badge
                        variant="outline"
                        className={
                          lead.daysSinceContact >= 5
                            ? "border-red-300 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                            : lead.daysSinceContact >= 2
                            ? "border-yellow-300 bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
                            : "border-green-300 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                        }
                      >
                        {lead.daysSinceContact}d
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 h-7 w-7"
                      onClick={() => handleViewDetail(lead)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <LeadDetailsDialog
        lead={selectedLead}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdated={handleUpdated}
      />

      <CreateLeadDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleUpdated}
      />
    </>
  );
}
