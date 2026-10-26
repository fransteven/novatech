"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  CircleAlert,
  Download,
  Loader2,
  Minus,
  PackageCheck,
  PackagePlus,
  Plus,
  ScanLine,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { EmptyState } from "@/components/ui/empty-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScanButton } from "@/components/scanner";
import { ConditionBadge } from "@/components/inventory/condition-badge";
import {
  ProductPicker,
  describeAttributes,
  type PickerProduct,
} from "@/components/purchases/product-picker";
import { QuickProductSheet, type CountCategory } from "./quick-product-sheet";
import { SerialDialog } from "./serial-dialog";
import { exportCountLabels } from "./count-labels";
import {
  addProductToCountAction,
  applyCountAction,
  assignInternalCodeAction,
  removeCountLineAction,
  removeSerialFromLineAction,
  scanIntoCountAction,
  updateCountLineAction,
} from "@/app/actions/stock-count-actions";
import { soundFeedback } from "@/lib/camera/sound-effects";
import { normalizeBarcode } from "@/lib/barcodes";
import { findCountProblems } from "@/lib/stock-count";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { ItemCondition } from "@/lib/validators/inventory-validator";
import type {
  StockCountDetail,
  StockCountLineView,
} from "@/services/stock-count-service";

interface CountWorkspaceProps {
  count: StockCountDetail;
  categories: CountCategory[];
  products: PickerProduct[];
}

type LastScan =
  | { kind: "ok"; name: string; detail: string }
  | { kind: "new"; code: string }
  | { kind: "error"; message: string };

const CONDITION_OPTIONS: { value: ItemCondition; label: string }[] = [
  { value: "new", label: "Nuevo" },
  { value: "used", label: "Segunda" },
];

/**
 * Pantalla de conteo: escáner primero. La pistola USB "teclea" el código y
 * manda Enter en el input siempre enfocado; la cámara es la alternativa en
 * celular. Conocido → +1; desconocido → ficha rápida.
 */
export const CountWorkspace = ({ count, categories, products }: CountWorkspaceProps) => {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [condition, setCondition] = useState<ItemCondition>("new");
  const [last, setLast] = useState<LastScan | null>(null);
  const [quickCode, setQuickCode] = useState<string | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickKey, setQuickKey] = useState(0);
  const [serialProduct, setSerialProduct] = useState<{ id: string; name: string } | null>(null);
  const [noCodeOpen, setNoCodeOpen] = useState(false);
  const [scanning, startScan] = useTransition();
  const [applying, startApply] = useTransition();

  const isDraft = count.status === "draft";
  const units = count.lines.reduce((sum, line) => sum + line.quantity, 0);
  const value = count.lines.reduce(
    (sum, line) => sum + line.quantity * Number(line.unitCost ?? 0),
    0,
  );
  const problems = findCountProblems(count.lines);
  const labelUnits = count.lines
    .filter((line) => line.internalCode)
    .reduce((sum, line) => sum + line.quantity, 0);

  const refocus = () => setTimeout(() => inputRef.current?.focus(), 50);

  const openQuick = (scanned: string | null) => {
    setQuickCode(scanned);
    setQuickKey((key) => key + 1); // formulario limpio en cada alta
    setQuickOpen(true);
  };

  const scan = (raw: string) => {
    const normalized = normalizeBarcode(raw);
    if (!normalized) return;
    setCode("");
    startScan(async () => {
      const result = await scanIntoCountAction({
        countId: count.id,
        code: normalized,
        condition,
      });
      if (!result.success) {
        soundFeedback.playError();
        setLast({ kind: "error", message: result.error });
        return;
      }
      const scanResult = result.data;
      if (scanResult.status === "unknown") {
        soundFeedback.playError();
        setLast({ kind: "new", code: scanResult.code });
        openQuick(scanResult.code);
        return;
      }
      soundFeedback.playSuccess();
      if (scanResult.quantity === null) {
        setSerialProduct(scanResult.product);
        setLast({ kind: "ok", name: scanResult.product.name, detail: "Falta el serial" });
        return;
      }
      setLast({
        kind: "ok",
        name: scanResult.product.name,
        detail: `${scanResult.quantity} contado(s)`,
      });
      router.refresh();
      refocus();
    });
  };

  const apply = () =>
    startApply(async () => {
      const result = await applyCountAction({ countId: count.id });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Inventario actualizado: ${result.data.units} unidad(es).`);
      router.refresh();
    });

  const addExistingWithoutCode = async (product: PickerProduct) => {
    setNoCodeOpen(false);
    if (product.isSerialized) {
      setSerialProduct({ id: product.id, name: product.name });
      return;
    }
    const added = await addProductToCountAction({
      countId: count.id,
      productId: product.id,
      condition,
      quantity: 1,
    });
    if (!added.success) {
      toast.error(added.error);
      return;
    }
    const labeled = await assignInternalCodeAction({ productId: product.id });
    if (labeled.success) toast.success(`${product.name}: código ${labeled.data}`);
    router.refresh();
  };

  const downloadLabels = () => {
    const total = exportCountLabels(count.lines, count.name);
    if (total === 0) toast.info("No hay productos con código interno en este conteo.");
    else toast.success(`${total} etiqueta(s) exportadas para NIIMBOT.`);
  };

  return (
    <div className="space-y-4">
      {isDraft ? (
        <section className="tf-trace-rail space-y-3 rounded-[10px] border border-border bg-card p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div role="radiogroup" aria-label="Condición" className="inline-flex rounded-md border border-border p-0.5">
              {CONDITION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={condition === option.value}
                  onClick={() => {
                    setCondition(option.value);
                    refocus();
                  }}
                  className={cn(
                    "h-9 rounded-[5px] px-3 text-sm font-medium transition-colors duration-150",
                    condition === option.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              Todo lo que escanees entra como <strong>{condition === "new" ? "nuevo" : "segunda"}</strong>.
            </span>
          </div>

          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              scan(code);
            }}
          >
            <div className="relative flex-1">
              <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                autoFocus
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Escanea con la pistola o escribe el código + Enter"
                className="mono h-12 pl-9 text-base"
                aria-label="Código de barras"
                autoComplete="off"
              />
            </div>
            <ScanButton
              mode="continuous"
              className="h-12 w-12 shrink-0"
              title="Escanear con cámara"
              description="Apunta al código de barras de cada producto"
              onScan={(value) => {
                scan(value);
                return { status: "accepted" };
              }}
            />
          </form>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setNoCodeOpen(true)}>
              <Tag className="mr-2 h-4 w-4" />
              Mercancía sin código
            </Button>
            {scanning && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Registrando…
              </span>
            )}
          </div>

          {last && <LastScanCard last={last} onCreate={() => last.kind === "new" && openQuick(last.code)} />}
        </section>
      ) : (
        <div className="flex items-center gap-2 rounded-[10px] border border-border bg-card p-4 text-sm">
          <PackageCheck className="h-5 w-5 text-[var(--tf-green)]" />
          Conteo aplicado al inventario
          {count.appliedAt && ` el ${new Date(count.appliedAt).toLocaleString("es-CO")}`}.
        </div>
      )}

      {count.lines.length === 0 ? (
        <EmptyState
          icon={ScanLine}
          headline="Aún no hay productos en este conteo"
          description="Escanea el primer código de barras para empezar."
        />
      ) : (
        <ul className="space-y-2" aria-label="Productos contados">
          {count.lines.map((line) => (
            <CountLineRow key={line.id} line={line} editable={isDraft} onChanged={() => router.refresh()} />
          ))}
        </ul>
      )}

      {/* Barra de totales */}
      <div className="sticky bottom-0 z-20 -mx-1 rounded-[10px] border border-border bg-card px-3 py-3 shadow-[var(--tf-shadow-floating)]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-4 text-sm">
            <span>
              <span className="mono font-semibold">{count.lines.length}</span>{" "}
              <span className="text-muted-foreground">productos</span>
            </span>
            <span>
              <span className="mono font-semibold">{units}</span>{" "}
              <span className="text-muted-foreground">unidades</span>
            </span>
            <span className="mono font-semibold">{formatCurrency(value)}</span>
          </div>
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="outline" onClick={downloadLabels} disabled={labelUnits === 0}>
              <Download className="mr-2 h-4 w-4" />
              Etiquetas ({labelUnits})
            </Button>
            {isDraft && (
              <ApplyButton problems={problems} units={units} applying={applying} onConfirm={apply} />
            )}
          </div>
        </div>
      </div>

      <QuickProductSheet
        key={quickKey}
        open={quickOpen}
        onOpenChange={(open) => {
          setQuickOpen(open);
          if (!open) refocus();
        }}
        countId={count.id}
        code={quickCode}
        condition={condition}
        categories={categories}
        onCreated={({ name, code: assigned }) => {
          soundFeedback.playSuccess();
          setLast({ kind: "ok", name, detail: `Creado · ${assigned}` });
          router.refresh();
        }}
      />

      <SerialDialog
        countId={count.id}
        product={serialProduct}
        condition={condition}
        onOpenChange={(open) => {
          if (!open) {
            setSerialProduct(null);
            refocus();
          }
        }}
        onAdded={(quantity) => {
          setLast({ kind: "ok", name: serialProduct?.name ?? "", detail: `${quantity} unidad(es)` });
          router.refresh();
        }}
      />

      <Dialog open={noCodeOpen} onOpenChange={setNoCodeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mercancía sin código</DialogTitle>
            <DialogDescription>
              Se le asigna un código interno (INT-…) para imprimir la etiqueta y
              escanearla de ahí en adelante.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <ProductPicker
              products={products}
              onSelect={addExistingWithoutCode}
              onProductCreated={addExistingWithoutCode}
            />
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => {
                setNoCodeOpen(false);
                openQuick(null);
              }}
            >
              <PackagePlus className="mr-2 h-4 w-4" />
              Crear producto nuevo (con foto / IA)
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const LastScanCard = ({ last, onCreate }: { last: LastScan; onCreate: () => void }) => (
  <div
    role="status"
    aria-live="polite"
    className={cn(
      "flex items-center gap-3 rounded-md border p-3",
      last.kind === "ok" && "border-[var(--tf-green)]/40 bg-[var(--tf-green-soft)]",
      last.kind !== "ok" && "border-[var(--tf-amber)]/40",
    )}
  >
    {last.kind === "ok" ? (
      <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--tf-green)]" />
    ) : (
      <CircleAlert className="h-5 w-5 shrink-0 text-[var(--tf-amber)]" />
    )}
    <div className="min-w-0 flex-1">
      {last.kind === "ok" && (
        <>
          <p className="truncate text-sm font-semibold">{last.name}</p>
          <p className="text-xs text-muted-foreground">{last.detail}</p>
        </>
      )}
      {last.kind === "new" && (
        <>
          <p className="text-sm font-semibold">Código nuevo</p>
          <p className="mono text-xs text-muted-foreground">{last.code}</p>
        </>
      )}
      {last.kind === "error" && <p className="text-sm">{last.message}</p>}
    </div>
    {last.kind === "new" && (
      <Button type="button" size="sm" variant="outline" onClick={onCreate}>
        Crear ficha
      </Button>
    )}
  </div>
);

const CountLineRow = ({
  line,
  editable,
  onChanged,
}: {
  line: StockCountLineView;
  editable: boolean;
  onChanged: () => void;
}) => {
  const [cost, setCost] = useState<number | null>(
    line.unitCost === null ? null : Number(line.unitCost),
  );
  const [pending, startTransition] = useTransition();

  const mutate = (fn: () => Promise<{ success: boolean; error?: string }>) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.success) toast.error(result.error ?? "No se pudo guardar");
      onChanged();
    });

  const saveCost = () => {
    const current = line.unitCost === null ? null : Number(line.unitCost);
    if (cost === current) return;
    mutate(() => updateCountLineAction({ lineId: line.id, unitCost: cost }));
  };

  const setQuantity = (quantity: number) => {
    if (quantity < 1) return;
    mutate(() => updateCountLineAction({ lineId: line.id, quantity }));
  };

  const attrs = describeAttributes(line.attributes);
  const missingCost = line.unitCost === null;

  return (
    <li
      className={cn(
        "rounded-[10px] border bg-card p-3 transition-opacity",
        missingCost ? "border-[var(--tf-amber)]/60" : "border-border",
        pending && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{line.productName}</p>
            <ConditionBadge condition={line.condition} />
            {line.internalCode && (
              <span className="mono rounded border border-border px-1.5 text-[11px]">{line.internalCode}</span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {[line.categoryName, attrs].filter(Boolean).join(" · ") || "Sin categoría"}
          </p>
        </div>
        {editable && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            aria-label={`Quitar ${line.productName}`}
            onClick={() => mutate(() => removeCountLineAction({ lineId: line.id }))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        {line.isSerialized ? (
          <div className="flex flex-wrap gap-1.5">
            {(line.serials ?? []).map((serial) => (
              <span key={serial} className="mono inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[11px]">
                {serial}
                {editable && (
                  <button
                    type="button"
                    aria-label={`Quitar serial ${serial}`}
                    onClick={() => mutate(() => removeSerialFromLineAction({ lineId: line.id, serial }))}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-1" aria-label="Cantidad">
            {editable && (
              <Button type="button" variant="outline" size="icon" className="h-9 w-9" aria-label="Restar" disabled={line.quantity <= 1} onClick={() => setQuantity(line.quantity - 1)}>
                <Minus className="h-4 w-4" />
              </Button>
            )}
            <span className="mono w-10 text-center text-base font-semibold">{line.quantity}</span>
            {editable && (
              <Button type="button" variant="outline" size="icon" className="h-9 w-9" aria-label="Sumar" onClick={() => setQuantity(line.quantity + 1)}>
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        <div className="ml-auto flex items-end gap-3">
          <div className="w-32">
            <p className={cn("mb-1 text-[11px]", missingCost ? "text-[var(--tf-amber)]" : "text-muted-foreground")}>
              {missingCost ? "Falta costo" : "Costo unit."}
            </p>
            <MoneyInput
              value={cost}
              onValueChange={setCost}
              onBlur={saveCost}
              disabled={!editable}
              className="h-9"
              aria-label={`Costo de ${line.productName}`}
            />
          </div>
          <div className="text-right">
            <p className="mb-1 text-[11px] text-muted-foreground">Subtotal</p>
            <p className="mono h-9 text-sm leading-9">
              {formatCurrency(line.quantity * Number(line.unitCost ?? 0))}
            </p>
          </div>
        </div>
      </div>
    </li>
  );
};

const ApplyButton = ({
  problems,
  units,
  applying,
  onConfirm,
}: {
  problems: string[];
  units: number;
  applying: boolean;
  onConfirm: () => void;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} disabled={applying || units === 0}>
        {applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageCheck className="mr-2 h-4 w-4" />}
        Aplicar
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {problems.length > 0 ? "Hay que completar el conteo" : "¿Aplicar al inventario?"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              {problems.length > 0 ? (
                <ul className="list-inside list-disc space-y-1 text-sm">
                  {problems.slice(0, 8).map((problem) => (
                    <li key={problem}>{problem}</li>
                  ))}
                  {problems.length > 8 && <li>…y {problems.length - 8} más.</li>}
                </ul>
              ) : (
                <p>
                  Entran {units} unidad(es) al stock con el costo indicado. Después
                  de aplicar el conteo ya no se puede editar.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{problems.length > 0 ? "Entendido" : "Cancelar"}</AlertDialogCancel>
            {problems.length === 0 && (
              <AlertDialogAction onClick={onConfirm}>Aplicar</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
