"use client";

import { useEffect, useRef, useState } from "react";
import type {
  FieldErrors,
  UseFormGetValues,
  UseFormRegister,
  UseFormSetValue,
} from "react-hook-form";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";

import type { CreatePurchaseSchema } from "@/lib/validators/purchase-validator";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { MoneyInput } from "@/components/ui/money-input";
import { ProductPicker, type PickerProduct } from "./product-picker";
import { PurchaseSerialsPanel } from "./purchase-serials-panel";

interface PurchaseLineRowProps {
  index: number;
  fieldId: string;
  detail: CreatePurchaseSchema["details"][number];
  lineAllocation?: {
    lineTotal: number;
    extraShare: number;
    landedUnitCost: number;
  };
  products: PickerProduct[];
  productById: Map<string, PickerProduct>;
  duplicateSerials: Set<string>;
  register: UseFormRegister<CreatePurchaseSchema>;
  errors: FieldErrors<CreatePurchaseSchema>;
  setValue: UseFormSetValue<CreatePurchaseSchema>;
  getValues: UseFormGetValues<CreatePurchaseSchema>;
  onProductCreated: (product: PickerProduct) => void;
  onRemove: () => void;
  autoFocusProduct?: boolean;
  numberField: { setValueAs: (v: unknown) => number };
  optionalNumberField: { setValueAs: (v: unknown) => number | undefined };
}

const FieldError = ({ message }: { message?: string }) =>
  message ? <p className="text-destructive text-xs">{message}</p> : null;

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function PurchaseLineRow({
  index,
  detail,
  lineAllocation,
  products,
  productById,
  duplicateSerials,
  register,
  errors,
  setValue,
  getValues,
  onProductCreated,
  onRemove,
  autoFocusProduct,
  numberField,
  optionalNumberField,
}: PurchaseLineRowProps) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const product = detail?.productId ? productById.get(detail.productId) : undefined;
  const isSerialized = product?.isSerialized ?? false;
  const quantity = Math.max(1, Math.trunc(toNumber(detail?.quantity)));
  const serialNumbers = (detail?.serialNumbers ?? []) as string[];
  const filledSerialsCount = serialNumbers.filter((s) => Boolean(s?.trim())).length;
  const isSerialsComplete = filledSerialsCount >= quantity;

  // Abierto por defecto si faltan seriales por ingresar
  const [serialsOpen, setSerialsOpen] = useState(!isSerialsComplete);

  // Autofocus en el combobox si la fila acaba de ser añadida
  useEffect(() => {
    if (autoFocusProduct) {
      const timer = setTimeout(() => {
        const comboboxButton = rowRef.current?.querySelector<HTMLButtonElement>(
          'button[role="combobox"]',
        );
        comboboxButton?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [autoFocusProduct]);

  const syncSerialSlots = (qty: number) => {
    const current = getValues(`details.${index}.serialNumbers`) ?? [];
    const next = Array.from({ length: qty }, (_, i) => current[i] ?? "");
    setValue(`details.${index}.serialNumbers`, next, {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  const handleDeleteClick = () => {
    const hasData =
      Boolean(detail?.productId) ||
      serialNumbers.some((s) => Boolean(s?.trim())) ||
      toNumber(detail?.unitCost) > 0;

    if (hasData) {
      setConfirmDeleteOpen(true);
    } else {
      onRemove();
    }
  };

  return (
    <>
      <div
        ref={rowRef}
        className="rounded-[10px] border border-border bg-card hover:bg-muted/40 transition-colors px-3 py-2.5 space-y-2"
      >
        {/* Fila principal compacta */}
        <div className="grid grid-cols-12 items-center gap-2 sm:gap-3">
          {/* Producto */}
          <div className="col-span-12 sm:col-span-5 space-y-1">
            <Label
              htmlFor={`detail-${index}-product`}
              className="text-[11.5px] text-muted-foreground sm:sr-only"
            >
              Producto
            </Label>
            <ProductPicker
              products={products}
              value={detail?.productId}
              onSelect={(selected) => {
                setValue(`details.${index}.productId`, selected.id, {
                  shouldValidate: true,
                  shouldDirty: true,
                });
                if (selected.isSerialized) {
                  const qty = Math.max(1, quantity);
                  setValue(`details.${index}.quantity`, qty, {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                  syncSerialSlots(qty);
                  setSerialsOpen(true);
                } else {
                  setValue(`details.${index}.serialNumbers`, [], {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                  setSerialsOpen(false);
                }
              }}
              onProductCreated={onProductCreated}
            />
            <FieldError message={errors.details?.[index]?.productId?.message} />
          </div>

          {/* Cantidad */}
          <div className="col-span-3 sm:col-span-2 space-y-1">
            <Label
              htmlFor={`detail-${index}-quantity`}
              className="text-[11.5px] text-muted-foreground sm:sr-only"
            >
              Cant.
            </Label>
            <Input
              id={`detail-${index}-quantity`}
              type="number"
              min="1"
              step="1"
              className="h-9 text-[13px] font-mono text-center px-1"
              {...register(`details.${index}.quantity`, {
                ...numberField,
                onChange: (event) => {
                  if (!isSerialized) return;
                  const value = Math.max(
                    1,
                    Math.trunc(toNumber(event.target.value)),
                  );
                  syncSerialSlots(value);
                },
              })}
            />
            <FieldError message={errors.details?.[index]?.quantity?.message} />
          </div>

          {/* Costo Unitario */}
          <div className="col-span-4 sm:col-span-3 space-y-1">
            <Label
              htmlFor={`detail-${index}-unitCost`}
              className="text-[11.5px] text-muted-foreground sm:sr-only"
            >
              Costo unitario
            </Label>
            <MoneyInput
              id={`detail-${index}-unitCost`}
              min="0"
              placeholder="0"
              className="h-9 text-[13px]"
              value={toNumber(detail?.unitCost)}
              onValueChange={(value) => setValue(`details.${index}.unitCost`, value ?? 0, { shouldValidate: true, shouldDirty: true })}
            />
            <FieldError message={errors.details?.[index]?.unitCost?.message} />
          </div>

          {/* Subtotal de línea */}
          <div className="col-span-4 sm:col-span-1 text-right">
            <span className="text-[10px] text-muted-foreground block sm:hidden">Total</span>
            <span className="font-mono text-[13px] font-semibold text-foreground truncate block">
              {formatCurrency(lineAllocation?.lineTotal ?? 0)}
            </span>
          </div>

          {/* Botón eliminar */}
          <div className="col-span-1 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleDeleteClick}
              aria-label="Eliminar producto"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Metadatos de prorrateo (solo si extraShare > 0) */}
        {(lineAllocation?.extraShare ?? 0) > 0 && (
          <div className="text-[11px] text-[color:var(--tf-fg-subtle)] flex items-center gap-2 px-1">
            <span>+ prorrateo: {formatCurrency(lineAllocation?.extraShare ?? 0)}</span>
            <span>·</span>
            <span className="text-foreground font-medium">
              Costo aterrizado: {formatCurrency(lineAllocation?.landedUnitCost ?? 0)} c/u
            </span>
          </div>
        )}

        {/* Bloque serializado colapsable */}
        {isSerialized && (
          <Collapsible open={serialsOpen} onOpenChange={setSerialsOpen}>
            <div className="flex items-center justify-between pt-1">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5"
                >
                  <Badge
                    variant="outline"
                    className={
                      isSerialsComplete
                        ? "bg-[color:var(--tf-green-soft)] text-[color:var(--tf-green)] border-[color:var(--tf-green)]/30 font-mono text-[11px]"
                        : "bg-[color:var(--tf-amber-soft)] text-[color:var(--tf-amber)] border-[color:var(--tf-amber)]/30 font-mono text-[11px]"
                    }
                  >
                    IMEI {filledSerialsCount}/{quantity}
                    {isSerialsComplete ? " listos" : " requeridos"}
                  </Badge>
                  <span className="text-[11px] font-medium text-[color:var(--tf-fg-subtle)]">
                    {serialsOpen ? "Ocultar" : "Editar IMEIs y condición"}
                  </span>
                  {serialsOpen ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
              </CollapsibleTrigger>
            </div>

            <CollapsibleContent>
              <PurchaseSerialsPanel
                lineIndex={index}
                quantity={quantity}
                serialNumbers={serialNumbers}
                duplicateSerials={duplicateSerials}
                register={register}
                errors={errors}
                setValue={setValue}
                getValues={getValues}
                isOpen={serialsOpen}
                optionalNumberField={optionalNumberField}
              />
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      {/* Confirmación para borrar fila con datos */}
      <AlertDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta línea de producto?</AlertDialogTitle>
            <AlertDialogDescription>
              Se perderán los datos del producto seleccionado, cantidad, costos y
              números de serie ingresados para esta fila.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Conservar línea</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirmDeleteOpen(false);
                onRemove();
              }}
            >
              Eliminar línea
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
