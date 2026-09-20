"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useFieldArray,
  useForm,
  useWatch,
  type FieldErrors,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PackagePlus, Plus } from "lucide-react";

import {
  createPurchaseSchema,
  type CreatePurchaseSchema,
} from "@/lib/validators/purchase-validator";
import { createPurchaseAction } from "@/app/actions/purchase-actions";
import { allocateExtraCosts, derivePaymentStatus } from "@/lib/purchase-costs";
import { findDuplicateSerials, normalizeSerial } from "@/lib/serials";
import { formatCurrency } from "@/lib/formatters";
import type { ItemCondition } from "@/lib/validators/inventory-validator";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/ui/empty-state";

import { ProviderPicker } from "./provider-picker";
import { ProviderDialog } from "./provider-dialog";
import { type PickerProduct } from "./product-picker";
import { PurchaseLineRow } from "./purchase-line-row";
import { PurchaseExtraCosts } from "./purchase-extra-costs";
import {
  PurchasePaymentSection,
  type PaymentMode,
} from "./purchase-payment-section";
import { PurchaseSummaryBar } from "./purchase-summary-bar";

interface PurchaseFormProps {
  providers: { id: string; name: string }[];
  cashAccounts: { id: string; name: string; balance?: string | number }[];
  products: PickerProduct[];
  onProviderCreated?: (provider: { id: string; name: string }) => void;
  onSuccess: () => void;
  onCancel?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
  className?: string;
}

const emptyLine = {
  productId: "",
  quantity: 1,
  unitCost: 0,
  serialNumbers: [] as string[],
  condition: "new" as ItemCondition,
  warrantyMonths: null,
  conditionDetails: null,
  notes: "",
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isBlank = (value: unknown) =>
  value === "" || value === null || value === undefined;

const numberField = { setValueAs: (v: unknown) => (isBlank(v) ? 0 : Number(v)) };
const optionalNumberField = {
  setValueAs: (v: unknown) => (isBlank(v) ? undefined : Number(v)),
};

const firstErrorMessage = (node: unknown): string | undefined => {
  if (!node || typeof node !== "object") return undefined;

  const message = (node as { message?: unknown }).message;
  if (typeof message === "string" && message) return message;

  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === "ref" || key === "types") continue;
    const found = firstErrorMessage(value);
    if (found) return found;
  }
  return undefined;
};

const FieldError = ({ message, id }: { message?: string; id?: string }) =>
  message ? (
    <p id={id} className="text-destructive text-xs">
      {message}
    </p>
  ) : null;

const todayInputValue = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

export function PurchaseForm({
  providers: initialProviders,
  cashAccounts,
  products: initialProducts,
  onProviderCreated,
  onSuccess,
  onCancel,
  onDirtyChange,
  className,
}: PurchaseFormProps) {
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState(initialProviders);
  const [products, setProducts] = useState(initialProducts);
  const [createProviderOpen, setCreateProviderOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("paid");
  const [autoFocusLineIndex, setAutoFocusLineIndex] = useState<number | null>(
    null,
  );
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );

  useEffect(() => {
    setProviders(initialProviders);
  }, [initialProviders]);

  const form = useForm<CreatePurchaseSchema>({
    resolver: zodResolver(
      createPurchaseSchema,
    ) as unknown as Resolver<CreatePurchaseSchema>,
    defaultValues: {
      idempotencyKey,
      providerId: "",
      purchaseDate: new Date(),
      invoiceNumber: "",
      notes: "",
      details: [{ ...emptyLine }],
      extraCosts: [],
      amountPaid: 0,
      accountId: null,
      paymentMethod: "transfer",
      referenceCode: "",
    },
  });

  const detailsArray = useFieldArray({ control: form.control, name: "details" });
  const extraCostsArray = useFieldArray({
    control: form.control,
    name: "extraCosts",
  });

  const watchedDetails = useWatch({ control: form.control, name: "details" });
  const watchedExtraCosts = useWatch({
    control: form.control,
    name: "extraCosts",
  });
  const watchedAmountPaid = useWatch({
    control: form.control,
    name: "amountPaid",
  });
  const accountId = useWatch({ control: form.control, name: "accountId" });
  const watchedPurchaseDate = useWatch({
    control: form.control,
    name: "purchaseDate",
  });
  const watchedPaymentMethod = useWatch({
    control: form.control,
    name: "paymentMethod",
  });
  const watchedProviderId = useWatch({
    control: form.control,
    name: "providerId",
  });
  const watchedInvoiceNumber = useWatch({
    control: form.control,
    name: "invoiceNumber",
  });
  const watchedNotes = useWatch({ control: form.control, name: "notes" });

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  // --- Totales derivados del estado del formulario ---
  // Sin memo a propósito: es la misma función pura que corre el servidor sobre
  // un puñado de líneas, y memorizarla fue el origen del bug del total en 0.
  const allocation = allocateExtraCosts(
    (watchedDetails ?? []).map((detail) => ({
      quantity: Math.max(1, Math.trunc(toNumber(detail?.quantity))),
      unitCost: toNumber(detail?.unitCost),
    })),
    (watchedExtraCosts ?? []).reduce(
      (acc, cost) => acc + toNumber(cost?.amount),
      0,
    ),
  );

  const total = allocation.total;
  const amountPaid = toNumber(watchedAmountPaid);
  const pending = Math.max(0, total - amountPaid);
  const totalExtraCosts = allocation.extraCostsAmount;

  // Unidades totales y líneas para el contador en cabecera
  const totalUnits = (watchedDetails ?? []).reduce(
    (acc, d) => acc + Math.max(1, Math.trunc(toNumber(d?.quantity))),
    0,
  );
  const totalLines = detailsArray.fields.length;

  // Seriales repetidos
  const duplicateSerials = new Set(
    findDuplicateSerials(
      (watchedDetails ?? []).flatMap((detail) =>
        (detail?.serialNumbers ?? []).filter(Boolean),
      ) as string[],
    ),
  );

  // Cantidad de IMEIs faltantes en líneas serializadas
  const missingSerialsCount = (watchedDetails ?? []).reduce((acc, detail) => {
    const prod = detail?.productId ? productById.get(detail.productId) : undefined;
    if (!prod?.isSerialized) return acc;
    const qty = Math.max(1, Math.trunc(toNumber(detail?.quantity)));
    const filled = (detail?.serialNumbers ?? []).filter((s) =>
      Boolean(s?.trim()),
    ).length;
    return acc + Math.max(0, qty - filled);
  }, 0);

  // Notificar al Sheet si el formulario tiene datos ingresados para evitar cierre accidental
  const hasEnteredData =
    form.formState.isDirty ||
    Boolean(watchedProviderId) ||
    Boolean(watchedInvoiceNumber) ||
    Boolean(watchedNotes) ||
    detailsArray.fields.length > 1 ||
    Boolean(watchedDetails?.[0]?.productId) ||
    (watchedExtraCosts?.length ?? 0) > 0 ||
    Boolean(
      watchedDetails?.some(
        (d) => (d?.serialNumbers?.filter(Boolean).length ?? 0) > 0,
      ),
    );

  useEffect(() => {
    onDirtyChange?.(hasEnteredData);
  }, [hasEnteredData, onDirtyChange]);

  // Contado = pagar el total; el monto sigue al total mientras ese sea el modo.
  useEffect(() => {
    if (paymentMode === "paid") {
      form.setValue("amountPaid", total, { shouldValidate: false });
    }
  }, [paymentMode, total, form]);

  const applyPaymentMode = (mode: PaymentMode) => {
    setPaymentMode(mode);
    if (mode === "paid") {
      form.setValue("amountPaid", total, {
        shouldValidate: false,
        shouldDirty: true,
      });
    } else if (mode === "pending") {
      form.setValue("amountPaid", 0, {
        shouldValidate: false,
        shouldDirty: true,
      });
      form.setValue("accountId", null, {
        shouldValidate: false,
        shouldDirty: true,
      });
    }
  };

  const handleAmountPaidChange = (value: number) => {
    setPaymentMode(derivePaymentStatus(value, total));
  };

  const handleAddLine = () => {
    const nextIndex = detailsArray.fields.length;
    detailsArray.append({ ...emptyLine });
    setAutoFocusLineIndex(nextIndex);
  };

  const onSubmit = async (values: CreatePurchaseSchema) => {
    setLoading(true);
    try {
      const payload = {
        ...values,
        idempotencyKey,
        purchaseDate: values.purchaseDate ?? new Date(),
        details: values.details.map((detail) => {
          const product = productById.get(detail.productId);
          return {
            ...detail,
            quantity: Math.max(1, Math.trunc(toNumber(detail.quantity))),
            unitCost: toNumber(detail.unitCost),
            serialNumbers: product?.isSerialized
              ? (detail.serialNumbers ?? [])
                  .map(normalizeSerial)
                  .filter(Boolean)
              : undefined,
            // Los no serializados no generan unidad física: entran como nuevos.
            condition: product?.isSerialized ? detail.condition : "new",
            warrantyMonths:
              product?.isSerialized && detail.condition !== "new"
                ? (detail.warrantyMonths ?? null)
                : null,
          };
        }),
        extraCosts: (values.extraCosts ?? []).filter(
          (cost) => toNumber(cost.amount) > 0,
        ),
        amountPaid: toNumber(values.amountPaid),
        accountId: toNumber(values.amountPaid) > 0 ? values.accountId : null,
        expectedTotal: total,
      };

      const res = await createPurchaseAction(payload);

      if (res.success) {
        toast.success("Compra registrada", {
          description: `Total ${formatCurrency(total)} · ${
            pending > 0
              ? `Saldo pendiente ${formatCurrency(pending)}`
              : "Pagada de contado"
          }`,
        });
        form.reset();
        setIdempotencyKey(crypto.randomUUID());
        onSuccess();
      } else {
        toast.error(res.error || "Error al registrar compra");
      }
    } catch {
      toast.error("Ocurrió un error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const onInvalid = (errors: FieldErrors<CreatePurchaseSchema>) => {
    toast.error(
      firstErrorMessage(errors) ?? "Revisa los datos del formulario",
    );
  };

  // Fecha controlada: formato YYYY-MM-DD
  const dateInputValue = watchedPurchaseDate
    ? new Date(
        new Date(watchedPurchaseDate).getTime() -
          new Date(watchedPurchaseDate).getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 10)
    : todayInputValue();

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit, onInvalid)}
      className={cn("flex flex-1 flex-col min-h-0", className)}
    >
      <div className="flex-1 overflow-y-auto min-h-0 px-4 sm:px-6 py-4 sm:py-5 space-y-6">
        {/* ---------- Cabecera de compra ---------- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
          <div className="col-span-1 sm:col-span-2 lg:col-span-1 space-y-1.5 min-w-0">
            <div className="flex items-center justify-between">
              <Label htmlFor="provider-picker" className="text-xs">
                Proveedor *
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-xs text-[color:var(--tf-accent)] hover:text-[color:var(--tf-accent)] hover:bg-[color:var(--tf-accent-soft)]"
                onClick={() => setCreateProviderOpen(true)}
              >
                <Plus className="h-3 w-3 mr-1" />
                Nuevo
              </Button>
            </div>
            <ProviderPicker
              providers={providers}
              value={watchedProviderId}
              onSelect={(provider) =>
                form.setValue("providerId", provider.id, {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
              onProviderCreated={(provider) => {
                setProviders((prev) => {
                  if (prev.some((p) => p.id === provider.id)) return prev;
                  return [...prev, provider];
                });
                form.setValue("providerId", provider.id, {
                  shouldValidate: true,
                  shouldDirty: true,
                });
                onProviderCreated?.(provider);
              }}
            />
            <FieldError
              id="provider-select-error"
              message={form.formState.errors.providerId?.message}
            />
          </div>

          <div className="col-span-1 space-y-1.5 min-w-0">
            <Label htmlFor="purchase-date-input" className="text-xs">
              Fecha de compra
            </Label>
            <Input
              id="purchase-date-input"
              type="date"
              value={dateInputValue}
              className="h-9 text-[13px] w-full min-w-0"
              onChange={(event) =>
                form.setValue(
                  "purchaseDate",
                  event.target.value
                    ? new Date(`${event.target.value}T12:00:00`)
                    : new Date(),
                  { shouldValidate: true, shouldDirty: true },
                )
              }
            />
          </div>

          <div className="col-span-1 space-y-1.5 min-w-0">
            <Label htmlFor="invoice-number-input" className="text-xs">
              Factura / Comprobante
            </Label>
            <Input
              id="invoice-number-input"
              placeholder="Ej. FAC-001"
              className="h-9 text-[13px] w-full min-w-0"
              {...form.register("invoiceNumber")}
            />
          </div>
        </div>

        <ProviderDialog
          open={createProviderOpen}
          onOpenChange={setCreateProviderOpen}
          onCreated={(provider) => {
            setProviders((prev) => {
              if (prev.some((p) => p.id === provider.id)) return prev;
              return [...prev, provider];
            });
            form.setValue("providerId", provider.id, {
              shouldValidate: true,
              shouldDirty: true,
            });
            onProviderCreated?.(provider);
          }}
        />

        <Separator />

        {/* ---------- Líneas de producto ---------- */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Label className="text-base font-semibold">Productos</Label>
                {totalLines > 0 && (
                  <span className="font-mono text-xs text-muted-foreground">
                    ({totalLines} línea{totalLines === 1 ? "" : "s"} · {totalUnits}{" "}
                    unidad{totalUnits === 1 ? "" : "es"})
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Los productos serializados solicitan un IMEI por unidad.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs font-medium"
              onClick={handleAddLine}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Agregar línea
            </Button>
          </div>

          {detailsArray.fields.length === 0 ? (
            <EmptyState
              icon={PackagePlus}
              headline="No hay productos en esta compra"
              description="Agrega al menos una línea para registrar la entrada a inventario."
              action={{
                label: "Agregar producto",
                onClick: handleAddLine,
              }}
              className="py-8 bg-muted/20 border-dashed"
            />
          ) : (
            <div className="space-y-2.5">
              {detailsArray.fields.map((field, index) => (
                <PurchaseLineRow
                  key={field.id}
                  fieldId={field.id}
                  index={index}
                  detail={
                    watchedDetails?.[index] ?? {
                      productId: "",
                      quantity: 1,
                      unitCost: 0,
                      condition: "new",
                    }
                  }
                  lineAllocation={allocation.lines[index]}
                  products={products}
                  productById={productById}
                  duplicateSerials={duplicateSerials}
                  register={form.register}
                  errors={form.formState.errors}
                  setValue={form.setValue}
                  getValues={form.getValues}
                  onProductCreated={(created) =>
                    setProducts((prev) => [created, ...prev])
                  }
                  onRemove={() => detailsArray.remove(index)}
                  autoFocusProduct={autoFocusLineIndex === index}
                  numberField={numberField}
                  optionalNumberField={optionalNumberField}
                />
              ))}
            </div>
          )}

          {form.formState.errors.details?.message && (
            <p className="text-destructive text-xs">
              {form.formState.errors.details.message}
            </p>
          )}
        </div>

        <Separator />

        {/* ---------- Costos adicionales ---------- */}
        <PurchaseExtraCosts
          fields={extraCostsArray.fields}
          watchedExtraCosts={watchedExtraCosts}
          register={form.register}
          setValue={form.setValue}
          errors={form.formState.errors}
          onAppend={(cost) => extraCostsArray.append(cost)}
          onRemove={(index) => extraCostsArray.remove(index)}
          totalExtraCosts={totalExtraCosts}
        />

        <Separator />

        {/* ---------- Pago al proveedor ---------- */}
        <PurchasePaymentSection
          paymentMode={paymentMode}
          onPaymentModeChange={applyPaymentMode}
          total={total}
          amountPaid={amountPaid}
          onAmountPaidChange={handleAmountPaidChange}
          cashAccounts={cashAccounts}
          accountId={accountId}
          paymentMethod={watchedPaymentMethod ?? "transfer"}
          register={form.register}
          errors={form.formState.errors}
          setValue={form.setValue}
        />

        <Separator />

        {/* ---------- Notas ---------- */}
        <div className="space-y-1.5">
          <Label htmlFor="purchase-notes-textarea" className="text-xs">
            Notas de la compra
          </Label>
          <Textarea
            id="purchase-notes-textarea"
            rows={2}
            placeholder="Observaciones de la compra..."
            className="text-[13px] resize-none"
            {...form.register("notes")}
          />
        </div>
      </div>

      {/* ---------- Footer Sticky de Resumen y Submit ---------- */}
      <PurchaseSummaryBar
        total={total}
        subtotal={allocation.subtotal}
        extraCostsAmount={totalExtraCosts}
        amountPaid={amountPaid}
        pending={pending}
        loading={loading}
        duplicateSerialsCount={duplicateSerials.size}
        missingSerialsCount={missingSerialsCount}
        onCancel={() => onCancel?.()}
      />
    </form>
  );
}
