"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/formatters";
import { StageBadge } from "./stage-badge";
import { AmortizationPreview } from "./amortization-preview";
import { MarketingSuggestions } from "./marketing-suggestions";
import {
  getAmortizationPreviewAction,
  updateLeadStageAction,
  addLeadActivityAction,
} from "@/app/actions/lead-actions";
import { toast } from "sonner";
import {
  Phone,
  User,
  Package,
  TrendingUp,
  Calendar,
  ChevronRight,
  MessageSquare,
  Loader2,
} from "lucide-react";
import type { ScheduleEntry } from "@/lib/credit/amortization";

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
  activities?: Array<{
    id: string;
    kind: string;
    content: string;
    createdAt: Date;
  }>;
};

interface LeadDetailsDialogProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

const STAGES = ["nuevo", "contactado", "negociando", "ganado", "perdido"] as const;
const STAGE_LABELS: Record<string, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  negociando: "Negociando",
  ganado: "Ganado",
  perdido: "Perdido",
};

const KIND_LABELS: Record<string, string> = {
  nota: "Nota",
  cambio_etapa: "Cambio de etapa",
  contacto: "Contacto",
  ia_sugerencia: "Sugerencia IA",
};

export function LeadDetailsDialog({
  lead,
  open,
  onOpenChange,
  onUpdated,
}: LeadDetailsDialogProps) {
  const [schedule, setSchedule] = useState<ScheduleEntry[] | null>(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [newStage, setNewStage] = useState<string>("");
  const [lostReason, setLostReason] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [isPending, startTransition] = useTransition();

  const lastSuggestion = lead?.activities
    ?.filter((a) => a.kind === "ia_sugerencia")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
    ?.content;

  useEffect(() => {
    if (!open || !lead) return;
    setNewStage(lead.stage);
    setLostReason(lead.lostReason ?? "");
    setNoteContent("");
    setSchedule(null);
  }, [open, lead]);

  const loadSchedule = async () => {
    if (!lead || schedule) return;
    setLoadingSchedule(true);
    const res = await getAmortizationPreviewAction(lead.id);
    setLoadingSchedule(false);
    if (res.success && res.data) setSchedule(res.data as ScheduleEntry[]);
    else toast.error("Error al cargar la amortización");
  };

  const handleStageChange = () => {
    if (!lead || newStage === lead.stage) return;
    startTransition(async () => {
      const res = await updateLeadStageAction({
        leadId: lead.id,
        stage: newStage,
        lostReason: newStage === "perdido" ? lostReason : undefined,
      });
      if (res.success) {
        toast.success("Etapa actualizada");
        onUpdated();
        onOpenChange(false);
      } else {
        toast.error(res.error ?? "Error al actualizar");
      }
    });
  };

  const handleAddNote = () => {
    if (!lead || !noteContent.trim()) return;
    startTransition(async () => {
      const res = await addLeadActivityAction({
        leadId: lead.id,
        kind: "nota",
        content: noteContent.trim(),
      });
      if (res.success) {
        toast.success("Nota guardada");
        setNoteContent("");
        onUpdated();
      } else {
        toast.error(res.error ?? "Error al guardar nota");
      }
    });
  };

  if (!lead) return null;

  const monthlyPct = (lead.interestRate * 100).toFixed(1);
  const isActive = ["nuevo", "contactado", "negociando"].includes(lead.stage);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{lead.prospectName}</span>
            <StageBadge stage={lead.stage} />
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{lead.productDescription}</p>
        </DialogHeader>

        <Tabs defaultValue="resumen" onValueChange={(v) => v === "amortizacion" && loadSchedule()}>
          <TabsList>
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="amortizacion">Amortización</TabsTrigger>
            <TabsTrigger value="marketing">Marketing IA</TabsTrigger>
            <TabsTrigger value="actividad">Actividad</TabsTrigger>
          </TabsList>

          {/* TAB: Resumen */}
          <TabsContent value="resumen" className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <InfoRow icon={User} label="Prospecto" value={lead.prospectName} />
              <InfoRow icon={Phone} label="Teléfono" value={lead.prospectPhone} />
              <InfoRow icon={Package} label="Producto" value={lead.productDescription} />
              <InfoRow
                icon={Calendar}
                label="Sin contacto"
                value={`${lead.daysSinceContact} día(s)`}
                valueClass={lead.daysSinceContact >= 2 ? "text-destructive" : ""}
              />
              <InfoRow
                icon={TrendingUp}
                label="Precio venta"
                value={formatCurrency(lead.salePrice)}
                valueClass="text-primary"
              />
              <InfoRow
                icon={TrendingUp}
                label="Margen"
                value={formatCurrency(lead.margin)}
                valueClass="text-green-600 dark:text-green-400"
              />
            </div>

            <div className="rounded-lg border p-3 text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">Crédito:</span>{" "}
                <strong>{monthlyPct}% mensual × {lead.termMonths} cuotas</strong>
              </p>
              <p>
                <span className="text-muted-foreground">Costo:</span>{" "}
                {formatCurrency(lead.costPrice)}
              </p>
              {lead.notes && (
                <p>
                  <span className="text-muted-foreground">Notas:</span> {lead.notes}
                </p>
              )}
              {lead.layawayId && (
                <p className="text-green-600 dark:text-green-400 font-medium">
                  ✓ Convertido a crédito (ID: {lead.layawayId.slice(0, 8)})
                </p>
              )}
            </div>

            {/* Cambio de etapa */}
            {isActive && (
              <div className="space-y-2 border-t pt-3">
                <Label>Cambiar etapa</Label>
                <div className="flex items-center gap-2">
                  <Select value={newStage} onValueChange={setNewStage}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STAGE_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleStageChange}
                    disabled={isPending || newStage === lead.stage}
                    size="sm"
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {newStage === "perdido" && (
                  <Textarea
                    placeholder="Motivo de pérdida…"
                    value={lostReason}
                    onChange={(e) => setLostReason(e.target.value)}
                    rows={2}
                  />
                )}
              </div>
            )}
          </TabsContent>

          {/* TAB: Amortización */}
          <TabsContent value="amortizacion" className="pt-2">
            {loadingSchedule ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : schedule ? (
              <AmortizationPreview schedule={schedule} />
            ) : (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Cargando cronograma…
              </div>
            )}
          </TabsContent>

          {/* TAB: Marketing IA */}
          <TabsContent value="marketing" className="pt-2">
            <MarketingSuggestions leadId={lead.id} lastSuggestion={lastSuggestion} />
          </TabsContent>

          {/* TAB: Actividad */}
          <TabsContent value="actividad" className="space-y-3 pt-2">
            {/* Add note */}
            <div className="space-y-2">
              <Label>Agregar nota</Label>
              <div className="flex gap-2">
                <Textarea
                  placeholder="Escribe una nota o comentario…"
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  rows={2}
                  className="flex-1"
                />
                <Button
                  onClick={handleAddNote}
                  disabled={isPending || !noteContent.trim()}
                  size="sm"
                  className="self-end"
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MessageSquare className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Activity list */}
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {(lead.activities ?? []).length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">
                  Sin actividad registrada
                </p>
              ) : (
                (lead.activities ?? []).map((act) => (
                  <div
                    key={act.id}
                    className="rounded-md border p-3 text-sm space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs capitalize">
                        {KIND_LABELS[act.kind] ?? act.kind}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(act.createdAt).toLocaleDateString("es-CO", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {act.kind === "ia_sugerencia" ? (
                      <pre className="whitespace-pre-wrap text-xs font-sans text-muted-foreground line-clamp-4">
                        {act.content}
                      </pre>
                    ) : (
                      <p className="text-muted-foreground">{act.content}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  valueClass = "",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-sm font-medium ${valueClass}`}>{value}</p>
      </div>
    </div>
  );
}
