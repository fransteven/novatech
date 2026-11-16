"use client";

import { BRAND } from "@/config/brand";
import { useState, type ReactNode } from "react";
import {
  CalendarClock,
  HandCoins,
  MessageCircle,
  Phone,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import {
  BOARD_TIMEZONE,
  whatsappLink,
  type CreditBoard,
  type CreditBoardPayment,
  type CreditBoardRow,
} from "@/lib/credit/daily-board";

type BoardTab = "hoy" | "mora" | "proximos" | "cobrados";

/** Sustantivo del producto de cartera, en singular y minúscula. */
type Noun = "crédito" | "préstamo";
const plural = (n: number, noun: Noun) => `${n} ${noun}${n === 1 ? "" : "s"}`;

export interface CollectionsBoardProps {
  board: CreditBoard;
  /** Texto del botón y título del panel. */
  title: string;
  noun: Noun;
  /** Diálogo de pago para el renglón seleccionado (null = cerrado). */
  renderPayment: (entry: CreditBoardRow | null, close: () => void) => ReactNode;
  /** Clases del botón disparador, para igualarlo a las acciones vecinas. */
  triggerClassName?: string;
}

const longDate = new Intl.DateTimeFormat("es-CO", {
  timeZone: BOARD_TIMEZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});
const shortDate = new Intl.DateTimeFormat("es-CO", {
  timeZone: BOARD_TIMEZONE,
  day: "numeric",
  month: "short",
});
const timeOfDay = new Intl.DateTimeFormat("es-CO", {
  timeZone: BOARD_TIMEZONE,
  hour: "numeric",
  minute: "2-digit",
});

const RISK_DOT: Record<string, string> = {
  verde: "bg-emerald-500",
  amarillo: "bg-amber-500",
  rojo: "bg-rose-500",
};

const PAYMENT_LABEL: Record<string, string> = {
  cuota: "Cuota",
  solo_interes: "Solo interés",
  abono_capital: "Abono a capital",
  abono_cuota: "Abono a cuota",
};

const BUCKET_STYLE: Record<CreditBoardRow["bucket"], { accent: string; hint: string }> = {
  mora: { accent: "bg-rose-500", hint: "text-rose-600 dark:text-rose-400" },
  hoy: { accent: "bg-amber-500", hint: "text-amber-600 dark:text-amber-400" },
  proximos: { accent: "bg-sky-500", hint: "text-sky-600 dark:text-sky-400" },
};

function installmentsLabel(numbers: number[]): string {
  if (numbers.length === 1) return `Cuota ${numbers[0]}`;
  return `Cuotas ${numbers[0]}–${numbers[numbers.length - 1]}`;
}

function dueHint(entry: CreditBoardRow): string {
  if (entry.bucket === "mora") {
    return entry.daysLate === 1 ? "1 día de mora" : `${entry.daysLate} días de mora`;
  }
  if (entry.bucket === "hoy") return "Vence hoy";
  const when = shortDate.format(new Date(entry.dueDate));
  return entry.daysToDue === 1 ? `Mañana · ${when}` : `En ${entry.daysToDue} días · ${when}`;
}

function reminderMessage(entry: CreditBoardRow, noun: Noun): string {
  const firstName = entry.customerName.split(" ")[0];
  const amount = formatCurrency(entry.amountDue);
  const cuota = installmentsLabel(entry.installments).toLowerCase();
  if (entry.bucket === "mora") {
    return `Hola ${firstName}, te escribimos de ${BRAND.name}. Tu ${noun} tiene ${dueHint(entry)} (${cuota}) por ${amount}. ¿Nos confirmas cuándo puedes realizar el pago?`;
  }
  if (entry.bucket === "hoy") {
    return `Hola ${firstName}, te recordamos de ${BRAND.name} que hoy vence tu ${cuota} por ${amount}. ¡Gracias por tu puntualidad!`;
  }
  return `Hola ${firstName}, te recordamos de ${BRAND.name} que tu ${cuota} por ${amount} vence el ${shortDate.format(new Date(entry.dueDate))}.`;
}

const sum = (rows: { amountDue: number }[]) => rows.reduce((s, r) => s + r.amountDue, 0);

export function CollectionsBoard({
  board,
  title,
  noun,
  renderPayment,
  triggerClassName,
}: CollectionsBoardProps) {
  const { overdue, dueToday, upcoming, paidToday } = board;
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<BoardTab>(
    dueToday.length > 0 ? "hoy" : overdue.length > 0 ? "mora" : "proximos",
  );
  const [paying, setPaying] = useState<CreditBoardRow | null>(null);

  const actionable = dueToday.length + overdue.length;
  const toCollect = sum(dueToday) + sum(overdue);
  const collected = paidToday.reduce((s, p) => s + p.amount, 0);
  const progress =
    toCollect + collected > 0 ? Math.round((collected / (toCollect + collected)) * 100) : 0;

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            size={triggerClassName ? "default" : "sm"}
            className={cn("relative gap-2", triggerClassName)}
            aria-label={`Abrir ${title.toLowerCase()}`}>
            <CalendarClock className="h-4 w-4" />
            {title}
            <span
              className={cn(
                "mono grid min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold leading-5",
                actionable > 0
                  ? "bg-primary-foreground text-primary"
                  : "bg-primary-foreground/25 text-primary-foreground",
              )}
            >
              {actionable}
            </span>
            {overdue.length > 0 && (
              <span className="absolute -top-1 -right-1 flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-rose-500 opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-rose-500" />
              </span>
            )}
          </Button>
        </SheetTrigger>

        <SheetContent size="wide" className="overflow-hidden">
          <SheetHeader className="border-b pb-4">
            <p className="mono text-[10px] font-semibold tracking-[0.14em] text-[color:var(--tf-fg-subtle)]">
              COBRANZA
            </p>
            <SheetTitle className="flex items-center gap-2 text-xl tracking-tight">
              <CalendarClock className="h-5 w-5 text-primary" />
              {title}
            </SheetTitle>
            <SheetDescription className="first-letter:uppercase">
              {longDate.format(new Date(`${board.dateKey}T12:00:00-05:00`))}
            </SheetDescription>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <SummaryCell
                label="Por cobrar hoy"
                value={formatCurrency(toCollect)}
                detail={plural(actionable, noun)}
              />
              <SummaryCell
                label="En mora"
                value={formatCurrency(sum(overdue))}
                detail={plural(overdue.length, noun)}
                tone={overdue.length > 0 ? "danger" : undefined}
              />
              <SummaryCell
                label="Cobrado hoy"
                value={formatCurrency(collected)}
                detail={`${paidToday.length} pago${paidToday.length === 1 ? "" : "s"}`}
                tone={collected > 0 ? "success" : undefined}
              />
            </div>

            <div className="mt-2">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-[width]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mono mt-1 text-[11px] text-muted-foreground">
                {progress}% de la jornada recaudado
              </p>
            </div>
          </SheetHeader>

          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as BoardTab)}
            className="flex min-h-0 flex-1 flex-col gap-0"
          >
            <div className="border-b px-5 py-3">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="hoy" className="gap-1.5">
                  Hoy <Count n={dueToday.length} />
                </TabsTrigger>
                <TabsTrigger value="mora" className="gap-1.5">
                  Mora <Count n={overdue.length} danger />
                </TabsTrigger>
                <TabsTrigger value="proximos" className="gap-1.5">
                  Próximos <Count n={upcoming.length} />
                </TabsTrigger>
                <TabsTrigger value="cobrados" className="gap-1.5">
                  Cobrados <Count n={paidToday.length} />
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <TabsContent value="hoy" className="mt-0 space-y-2">
                <EntryList
                  rows={dueToday}
                  empty="Ninguna cuota vence hoy."
                  emptyIcon={Clock}
                  onPay={setPaying}
                  noun={noun}
                />
              </TabsContent>
              <TabsContent value="mora" className="mt-0 space-y-2">
                <EntryList
                  rows={overdue}
                  empty={`Sin ${noun}s en mora. Cartera al día.`}
                  emptyIcon={CheckCircle2}
                  onPay={setPaying}
                  noun={noun}
                />
              </TabsContent>
              <TabsContent value="proximos" className="mt-0 space-y-2">
                <EntryList
                  rows={upcoming}
                  empty={`No hay cuotas en los próximos ${board.upcomingDays} días.`}
                  emptyIcon={CalendarDays}
                  onPay={setPaying}
                  noun={noun}
                />
              </TabsContent>
              <TabsContent value="cobrados" className="mt-0 space-y-2">
                <PaymentList rows={paidToday} noun={noun} />
              </TabsContent>
            </div>
          </Tabs>
        </SheetContent>
      </Sheet>

      {renderPayment(paying, () => setPaying(null))}
    </>
  );
}

function Count({ n, danger }: { n: number; danger?: boolean }) {
  return (
    <span
      className={cn(
        "mono rounded-full px-1.5 text-[10px] font-semibold leading-4",
        n > 0 && danger
          ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
          : "bg-muted-foreground/15 text-muted-foreground",
      )}
    >
      {n}
    </span>
  );
}

function SummaryCell({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "danger" | "success";
}) {
  return (
    <div className="rounded-md border bg-background/60 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mono truncate text-base font-semibold tracking-[-0.03em] sm:text-lg",
          tone === "danger" && "text-rose-600 dark:text-rose-400",
          tone === "success" && "text-emerald-600 dark:text-emerald-400",
        )}
      >
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );
}

function EmptyRow({ icon: Icon, text }: { icon: typeof Clock; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
      <Icon className="h-5 w-5" />
      {text}
    </div>
  );
}

function EntryList({
  rows,
  empty,
  emptyIcon,
  onPay,
  noun,
}: {
  rows: CreditBoardRow[];
  empty: string;
  emptyIcon: typeof Clock;
  onPay: (entry: CreditBoardRow) => void;
  noun: Noun;
}) {
  if (rows.length === 0) return <EmptyRow icon={emptyIcon} text={empty} />;
  return (
    <>
      {rows.map((entry) => (
        <EntryCard key={entry.creditId} entry={entry} onPay={onPay} noun={noun} />
      ))}
    </>
  );
}

function EntryCard({
  entry,
  onPay,
  noun,
}: {
  entry: CreditBoardRow;
  onPay: (entry: CreditBoardRow) => void;
  noun: Noun;
}) {
  const style = BUCKET_STYLE[entry.bucket];
  const wa = whatsappLink(entry.customerPhone, reminderMessage(entry, noun));

  return (
    <div className="relative overflow-hidden rounded-md border bg-card pl-4 pr-3 py-3">
      <span className={cn("absolute inset-y-0 left-0 w-1", style.accent)} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {entry.riskLevel && (
              <span
                className={cn("size-2 shrink-0 rounded-full", RISK_DOT[entry.riskLevel] ?? RISK_DOT.verde)}
                title={`Riesgo ${entry.riskLevel}`}
              />
            )}
            <p className="truncate font-medium">{entry.customerName}</p>
          </div>
          {entry.devices && (
            <p className="mono mt-0.5 truncate text-[11px] text-muted-foreground">
              {entry.devices}
            </p>
          )}
          <p className={cn("mt-1 flex items-center gap-1 text-xs font-medium", style.hint)}>
            {entry.bucket === "mora" && <AlertTriangle className="h-3 w-3" />}
            {dueHint(entry)}
            <span className="font-normal text-muted-foreground">
              · {installmentsLabel(entry.installments)}
            </span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="mono text-base font-semibold tracking-[-0.03em]">
            {formatCurrency(entry.amountDue)}
          </p>
          {entry.customerPhone && (
            <p className="mono text-[11px] text-muted-foreground">{entry.customerPhone}</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {wa && (
          <Button variant="outline" size="sm" className="h-8 px-2" asChild>
            <a href={wa} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="mr-1 h-4 w-4" /> WhatsApp
            </a>
          </Button>
        )}
        {entry.customerPhone && (
          <Button variant="outline" size="sm" className="h-8 px-2" asChild>
            <a href={`tel:${entry.customerPhone.replace(/\s/g, "")}`}>
              <Phone className="mr-1 h-4 w-4" /> Llamar
            </a>
          </Button>
        )}
        <Button size="sm" className="h-8 px-2" onClick={() => onPay(entry)}>
          <HandCoins className="mr-1 h-4 w-4" /> Registrar pago
        </Button>
      </div>
    </div>
  );
}

function PaymentList({ rows, noun }: { rows: CreditBoardPayment[]; noun: Noun }) {
  if (rows.length === 0) {
    return <EmptyRow icon={HandCoins} text={`Aún no se registran pagos de ${noun}s hoy.`} />;
  }
  return (
    <>
      {rows.map((p) => (
        <div
          key={p.id}
          className="relative flex items-center justify-between gap-3 overflow-hidden rounded-md border bg-card py-3 pl-4 pr-3"
        >
          <span className="absolute inset-y-0 left-0 w-1 bg-emerald-500" />
          <div className="min-w-0">
            <p className="truncate font-medium">{p.customerName}</p>
            <p className="text-xs text-muted-foreground">
              {PAYMENT_LABEL[p.type] ?? p.type}
              {p.scheduleNumber ? ` · cuota ${p.scheduleNumber}` : ""} ·{" "}
              {timeOfDay.format(new Date(p.createdAt))}
            </p>
          </div>
          <p className="mono shrink-0 font-semibold text-emerald-600 dark:text-emerald-400">
            +{formatCurrency(p.amount)}
          </p>
        </div>
      ))}
    </>
  );
}
