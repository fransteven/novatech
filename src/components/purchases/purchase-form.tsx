"use client";

import { useEffect, useState } from "react";
import {
  useFieldArray,
  useForm,
  useWatch,
  type FieldErrors,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";

import {
  createPurchaseSchema,
  type CreatePurchaseSchema,
} from "@/lib/validators/purchase-validator";
import { createPurchaseAction } from "@/app/actions/purchase-actions";
import { allocateExtraCosts, derivePaymentStatus } from "@/lib/purchase-costs";
import { findDuplicateSerials, normalizeSerial } from "@/lib/serials";
import { formatCurrency } from "@/lib/formatters";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ProviderDialog } from "./provider-dialog";
import { ProductPicker, type PickerProduct } from "./product-picker";

type PaymentMode = "paid" | "partial" | "pending";

const EXTRA_COST_PRESETS = ["Flete", "Casillero", "Arancel", "Comisión"];

interface PurchaseFormProps {
  providers: { id: string; name: string }[];
  cashAccounts: { id: string; name: string; balance?: string | number }[];
  products: PickerProduct[];
  onSuccess: () => void;
}

const emptyLine = {
  productId: "",
  quantity: 1,
  unitCost: 0,
  serialNumbers: [] as string[],
  conditionDetails: null,
  notes: "",
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isBlank = (value: unknown) =>
  value === "" || value === null || value === undefined;

/**
 * Los inputs `type="number"` entregan strings; sin esto el estado del
 * formulario guarda `"1500"` y cualquier comparación numérica queda a merced de
 * la coerción. Vacío es 0 en montos y "sin dato" en los campos opcionales.
 */
const numberField = { setValueAs: (v: unknown) => (isBlank(v) ? 0 : Number(v)) };
const optionalNumberField = {
  setValueAs: (v: unknown) => (isBlank(v) ? undefined : Number(v)),
};

/**
 * Primer mensaje de error del árbol de `formState.errors`. Sin esto, un error
 * en un campo que no pinta su mensaje deja el botón de enviar mudo.
 */
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

const FieldError = ({ message }: { message?: string }) =>
  message ? <p className="text-destructive text-xs">{message}</p> : null;

const todayInputValue = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

export function PurchaseForm({
  providers: initialProviders,
  cashAccounts,
  products: initialProducts,
  onSuccess,
}: PurchaseFormProps) {
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState(initialProviders);
  const [products, setProducts] = useState(initialProducts);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("paid");
  // Una llave por intento de registro: si el usuario hace doble clic, el
  // servidor reconoce el duplicado y devuelve la misma compra.
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );

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

  // `useWatch` entrega una copia nueva en cada cambio. `form.watch()` devolvía
  // SIEMPRE la misma referencia (RHF muta el array in place), así que cualquier
  // `useMemo` colgado de ella se quedaba congelado con los valores iniciales y
  // el formulario mandaba un total de $0 al servidor.
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

  const productById = new Map(products.map((product) => [product.id, product]));

  // --- Totales derivados del estado del formulario (nunca guardados a mano) ---
  // Sin memo a propósito: es la misma función pura que corre el servidor sobre
  // un puñado de líneas, y memorizarla fue justamente el origen del bug.
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

  // Contado = pagar el total; el monto sigue al total mientras ese sea el modo.
  useEffect(() => {
    if (paymentMode === "paid") {
      form.setValue("amountPaid", total, { shouldValidate: false });
    }
  }, [paymentMode, total, form]);

  /** El selector es un atajo; el monto pagado es la fuente de verdad. */
  const applyPaymentMode = (mode: PaymentMode) => {
    setPaymentMode(mode);
    if (mode === "paid") {
      form.setValue("amountPaid", total, { shouldValidate: false });
    } else if (mode === "pending") {
      form.setValue("amountPaid", 0, { shouldValidate: false });
      form.setValue("accountId", null, { shouldValidate: false });
    }
  };

  /**
   * Escribir el monto reclasifica la compra: 0 = crédito, total = contado.
   * No se toca `accountId`: al reescribir el monto se pasa por 0 y se perdería
   * la cuenta ya elegida. Si el monto queda en 0, `onSubmit` la anula igual.
   */
  const handleAmountPaidChange = (value: number) => {
    setPaymentMode(derivePaymentStatus(value, total));
  };

  // --- Seriales repetidos: aviso inmediato, antes de llegar al servidor ---
  const duplicateSerials = new Set(
    findDuplicateSerials(
      (watchedDetails ?? []).flatMap((detail) =>
        (detail?.serialNumbers ?? []).filter(Boolean),
      ) as string[],
    ),
  );

  const selectedAccount = cashAccounts.find(
    (account) => account.id === accountId,
  );
  const insufficientBalance =
    selectedAccount !== undefined &&
    amountPaid > Number(selectedAccount.balance ?? 0);

  /** Ajusta la lista de seriales al cambiar la cantidad de una línea serializada. */
  const syncSerialSlots = (index: number, quantity: number) => {
    const current = form.getValues(`details.${index}.serialNumbers`) ?? [];
    const next = Array.from({ length: quantity }, (_, i) => current[i] ?? "");
    form.setValue(`details.${index}.serialNumbers`, next);
  };

  /** Pegar varios IMEIs de una vez llena los campos siguientes y ajusta la cantidad. */
  const handleSerialPaste = (
    event: React.ClipboardEvent<HTMLInputElement>,
    lineIndex: number,
    serialIndex: number,
  ) => {
    const text = event.clipboardData.getData("text");
    const pasted = text
      .split(/[\s,;]+/)
      .map((value) => value.trim())
      .filter(Boolean);

    if (pasted.length <= 1) return;

    event.preventDefault();
    const current = form.getValues(`details.${lineIndex}.serialNumbers`) ?? [];
    const next = [...current];
    pasted.forEach((serial, offset) => {
      next[serialIndex + offset] = serial;
    });

    form.setValue(`details.${lineIndex}.serialNumbers`, next);
    form.setValue(`details.${lineIndex}.quantity`, next.length);
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
            pending > 0 ? `Saldo pendiente ${formatCurrency(pending)}` : "Pagada"
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

  /** Ningún error de validación puede dejar el botón mudo. */
  const onInvalid = (errors: FieldErrors<CreatePurchaseSchema>) => {
    toast.error(
      firstErrorMessage(errors) ?? "Revisa los datos del formulario",
    );
  };

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit, onInvalid)}
      className="space-y-6"
    >
      {/* ---------- Cabecera ---------- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Proveedor *</Label>
          <div className="flex items-center gap-2">
            <Select
              value={form.watch("providerId")}
              onValueChange={(val) =>
                form.setValue("providerId", val, { shouldValidate: true })
              }
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Seleccionar proveedor" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ProviderDialog
              onCreated={(provider) => {
                setProviders((prev) => [...prev, provider]);
                form.setValue("providerId", provider.id, {
                  shouldValidate: true,
                });
              }}
            />
          </div>
          <FieldError message={form.formState.errors.providerId?.message} />
        </div>

        <div className="space-y-2">
          <Label>Fecha de compra</Label>
          <Input
            type="date"
            defaultValue={todayInputValue()}
            onChange={(event) =>
              form.setValue(
                "purchaseDate",
                event.target.value
                  ? new Date(`${event.target.value}T12:00:00`)
                  : new Date(),
              )
            }
          />
        </div>

        <div className="space-y-2">
          <Label>Factura / Comprobante</Label>
          <Input {...form.register("invoiceNumber")} placeholder="Ej. FAC-001" />
        </div>
      </div>

      <Separator />

      {/* ---------- Líneas de producto ---------- */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base font-semibold">Productos</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Los productos serializados piden un IMEI por unidad.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => detailsArray.append({ ...emptyLine })}
          >
            <Plus className="h-4 w-4 mr-2" /> Agregar línea
          </Button>
        </div>

        {detailsArray.fields.map((field, index) => {
          const detail = watchedDetails?.[index];
          const product = detail?.productId
            ? productById.get(detail.productId)
            : undefined;
          const isSerialized = product?.isSerialized ?? false;
          const quantity = Math.max(1, Math.trunc(toNumber(detail?.quantity)));
          const line = allocation.lines[index];

          return (
            <div
              key={field.id}
              className="p-4 border border-border rounded-lg bg-muted/20 space-y-4"
            >
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 md:col-span-5 space-y-2">
                  <Label>Producto</Label>
                  <ProductPicker
                    products={products}
                    value={detail?.productId}
                    onSelect={(selected) => {
                      form.setValue(`details.${index}.productId`, selected.id, {
                        shouldValidate: true,
                      });
                      if (selected.isSerialized) {
                        const qty = Math.max(1, quantity);
                        form.setValue(`details.${index}.quantity`, qty);
                        syncSerialSlots(index, qty);
                      } else {
                        form.setValue(`details.${index}.serialNumbers`, []);
                      }
                    }}
                    onProductCreated={(created) =>
                      setProducts((prev) => [created, ...prev])
                    }
                  />
                  <FieldError
                    message={
                      form.formState.errors.details?.[index]?.productId?.message
                    }
                  />
                </div>

                <div className="col-span-4 md:col-span-2 space-y-2">
                  <Label>Cantidad</Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    {...form.register(`details.${index}.quantity`, {
                      ...numberField,
                      onChange: (event) => {
                        if (!isSerialized) return;
                        const value = Math.max(
                          1,
                          Math.trunc(toNumber(event.target.value)),
                        );
                        syncSerialSlots(index, value);
                      },
                    })}
                  />
                  <FieldError
                    message={
                      form.formState.errors.details?.[index]?.quantity?.message
                    }
                  />
                </div>

                <div className="col-span-8 md:col-span-3 space-y-2">
                  <Label>Costo unitario</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    {...form.register(`details.${index}.unitCost`, numberField)}
                  />
                  <FieldError
                    message={
                      form.formState.errors.details?.[index]?.unitCost?.message
                    }
                  />
                </div>

                <div className="col-span-12 md:col-span-2 flex md:items-end justify-between md:justify-end gap-2 pb-1">
                  <div className="md:hidden text-sm text-muted-foreground">
                    {formatCurrency(line?.lineTotal ?? 0)}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    disabled={detailsArray.fields.length === 1}
                    onClick={() => detailsArray.remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Subtotal línea: {formatCurrency(line?.lineTotal ?? 0)}</span>
                {(line?.extraShare ?? 0) > 0 && (
                  <>
                    <span>+ prorrateo: {formatCurrency(line.extraShare)}</span>
                    <span className="text-foreground font-medium">
                      Costo aterrizado: {formatCurrency(line.landedUnitCost)} c/u
                    </span>
                  </>
                )}
                {isSerialized && <Badge variant="outline">Serializado</Badge>}
              </div>

              {isSerialized && (
                <div className="space-y-3 border-t border-border pt-3">
                  <Label className="text-[13px]">
                    Seriales / IMEI ({quantity} requerido{quantity === 1 ? "" : "s"})
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Array.from({ length: quantity }).map((_, serialIndex) => {
                      const value =
                        detail?.serialNumbers?.[serialIndex] ?? "";
                      const isDuplicate =
                        Boolean(value) &&
                        duplicateSerials.has(normalizeSerial(String(value)));

                      return (
                        <div key={serialIndex} className="space-y-1">
                          <Input
                            placeholder={`IMEI #${serialIndex + 1}`}
                            aria-invalid={isDuplicate}
                            className={
                              isDuplicate ? "border-destructive" : undefined
                            }
                            {...form.register(
                              `details.${index}.serialNumbers.${serialIndex}`,
                            )}
                            onPaste={(event) =>
                              handleSerialPaste(event, index, serialIndex)
                            }
                          />
                          {isDuplicate && (
                            <p className="text-destructive text-[11px]">
                              Serial repetido en esta compra
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[12px]">Salud de batería (%)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="100"
                        placeholder="Ej. 95"
                        {...form.register(
                          `details.${index}.conditionDetails.batteryHealth`,
                          optionalNumberField,
                        )}
                      />
                      <FieldError
                        message={
                          form.formState.errors.details?.[index]
                            ?.conditionDetails?.batteryHealth?.message
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[12px]">Notas de condición</Label>
                      <Input
                        placeholder="Ej. rayón en marco"
                        {...form.register(`details.${index}.notes`)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {form.formState.errors.details?.message && (
          <p className="text-destructive text-sm">
            {form.formState.errors.details.message}
          </p>
        )}
      </div>

      <Separator />

      {/* ---------- Costos adicionales ---------- */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base font-semibold">Costos adicionales</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Se prorratean al costo de cada equipo (costo aterrizado).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {EXTRA_COST_PRESETS.map((preset) => (
              <Button
                key={preset}
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  extraCostsArray.append({ concept: preset, amount: 0 })
                }
              >
                <Plus className="h-3 w-3 mr-1" />
                {preset}
              </Button>
            ))}
          </div>
        </div>

        {extraCostsArray.fields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-2">
            <div className="flex-1 space-y-1">
              <Input
                placeholder="Concepto"
                {...form.register(`extraCosts.${index}.concept`)}
              />
              <FieldError
                message={
                  form.formState.errors.extraCosts?.[index]?.concept?.message
                }
              />
            </div>
            <div className="w-40 space-y-1">
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
                {...form.register(`extraCosts.${index}.amount`, numberField)}
              />
              <FieldError
                message={
                  form.formState.errors.extraCosts?.[index]?.amount?.message
                }
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={() => extraCostsArray.remove(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <Separator />

      {/* ---------- Pago ---------- */}
      <div className="space-y-4">
        <Label className="text-base font-semibold">Pago al proveedor</Label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Estado</Label>
            <Select
              value={paymentMode}
              onValueChange={(value) => applyPaymentMode(value as PaymentMode)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">Pagada de contado</SelectItem>
                <SelectItem value="partial">Abono parcial</SelectItem>
                <SelectItem value="pending">A crédito (sin pago)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Monto pagado ahora</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max={total > 0 ? total : undefined}
              {...form.register("amountPaid", {
                ...numberField,
                onChange: (event) =>
                  handleAmountPaidChange(toNumber(event.target.value)),
              })}
            />
            <FieldError message={form.formState.errors.amountPaid?.message} />
          </div>
        </div>

        {paymentMode !== "pending" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Cuenta de caja *</Label>
              <Select
                value={accountId ?? ""}
                onValueChange={(value) =>
                  form.setValue("accountId", value, { shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {cashAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} ({formatCurrency(Number(account.balance ?? 0))})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError
                message={form.formState.errors.accountId?.message}
              />
            </div>

            <div className="space-y-2">
              <Label>Método de pago</Label>
              <Select
                value={form.watch("paymentMethod")}
                onValueChange={(value) => form.setValue("paymentMethod", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="card">Tarjeta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Referencia</Label>
              <Input
                {...form.register("referenceCode")}
                placeholder="Comprobante o referencia"
              />
            </div>
          </div>
        )}

        {insufficientBalance && (
          <div className="flex items-start gap-2 text-[13px] text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              El pago supera el saldo registrado de la cuenta. Se registrará
              igual y la cuenta quedará en negativo.
            </span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Notas</Label>
        <Textarea
          {...form.register("notes")}
          placeholder="Observaciones de la compra..."
        />
      </div>

      {/* ---------- Totales ---------- */}
      <div className="flex flex-col items-end gap-2 p-4 bg-muted/30 rounded-lg border border-border">
        <div className="flex justify-between w-full md:w-2/3 lg:w-1/2 text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-mono">{formatCurrency(allocation.subtotal)}</span>
        </div>
        <div className="flex justify-between w-full md:w-2/3 lg:w-1/2 text-sm">
          <span className="text-muted-foreground">Costos adicionales</span>
          <span className="font-mono">
            {formatCurrency(allocation.extraCostsAmount)}
          </span>
        </div>
        <div className="flex justify-between w-full md:w-2/3 lg:w-1/2">
          <span className="font-bold text-lg">Total</span>
          <span className="font-mono font-bold text-lg text-[color:var(--tf-green)]">
            {formatCurrency(total)}
          </span>
        </div>
        <div className="flex justify-between w-full md:w-2/3 lg:w-1/2 text-sm">
          <span className="text-muted-foreground">Pagado ahora</span>
          <span className="font-mono">{formatCurrency(amountPaid)}</span>
        </div>
        <div className="flex justify-between w-full md:w-2/3 lg:w-1/2 text-sm">
          <span className="text-muted-foreground">Saldo al proveedor</span>
          <span
            className={`font-mono ${pending > 0 ? "text-amber-600 dark:text-amber-400 font-semibold" : ""}`}
          >
            {formatCurrency(pending)}
          </span>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-border">
        <Button
          type="submit"
          disabled={loading || duplicateSerials.size > 0}
          className="w-full md:w-auto min-w-[170px]"
        >
          {loading ? "Procesando..." : "Registrar compra"}
        </Button>
      </div>
    </form>
  );
}
