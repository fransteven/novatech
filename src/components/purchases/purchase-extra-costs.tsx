"use client";

import { useRef } from "react";
import type {
  FieldArrayWithId,
  FieldErrors,
  UseFormRegister,
  UseFormSetValue,
} from "react-hook-form";
import { Check, Plus, Trash2 } from "lucide-react";

import type { CreatePurchaseSchema } from "@/lib/validators/purchase-validator";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import { cn } from "@/lib/utils";

const EXTRA_COST_PRESETS = ["Flete", "Casillero", "Arancel", "Comisión"];

interface PurchaseExtraCostsProps {
  fields: FieldArrayWithId<CreatePurchaseSchema, "extraCosts", "id">[];
  watchedExtraCosts: CreatePurchaseSchema["extraCosts"];
  register: UseFormRegister<CreatePurchaseSchema>;
  setValue: UseFormSetValue<CreatePurchaseSchema>;
  errors: FieldErrors<CreatePurchaseSchema>;
  onAppend: (cost: { concept: string; amount: number }) => void;
  onRemove: (index: number) => void;
  totalExtraCosts: number;
}

const FieldError = ({ message }: { message?: string }) =>
  message ? <p className="text-destructive text-xs">{message}</p> : null;

export function PurchaseExtraCosts({
  fields,
  watchedExtraCosts,
  register,
  setValue,
  errors,
  onAppend,
  onRemove,
  totalExtraCosts,
}: PurchaseExtraCostsProps) {
  const amountInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const handlePresetClick = (preset: string) => {
    const existingIndex = (watchedExtraCosts ?? []).findIndex(
      (cost) => cost?.concept?.trim().toLowerCase() === preset.toLowerCase(),
    );

    if (existingIndex >= 0) {
      // Si ya existe, enfocar su campo de monto en lugar de duplicar
      amountInputsRef.current[existingIndex]?.focus();
      amountInputsRef.current[existingIndex]?.select();
    } else {
      // Si no existe, agregarlo y enfocarlo tras render
      onAppend({ concept: preset, amount: 0 });
      setTimeout(() => {
        const nextIndex = fields.length;
        amountInputsRef.current[nextIndex]?.focus();
      }, 50);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Label className="text-base font-semibold">Costos adicionales</Label>
            {totalExtraCosts > 0 && (
              <span className="font-mono text-xs font-semibold text-[color:var(--tf-accent)]">
                (+ {formatCurrency(totalExtraCosts)})
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Se prorratean al costo de cada equipo (costo aterrizado).
          </p>
        </div>

        {/* Chips inteligentes de presets */}
        <div className="flex flex-wrap gap-1.5">
          {EXTRA_COST_PRESETS.map((preset) => {
            const exists = (watchedExtraCosts ?? []).some(
              (cost) =>
                cost?.concept?.trim().toLowerCase() === preset.toLowerCase(),
            );

            return (
              <button
                key={preset}
                type="button"
                onClick={() => handlePresetClick(preset)}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border transition-[background-color,border-color,color] cursor-pointer select-none",
                  exists
                    ? "bg-[color:var(--tf-accent-soft)] text-[color:var(--tf-accent)] border-[color:var(--tf-accent)]/40 font-medium"
                    : "bg-card text-muted-foreground border-border hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {exists ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
                {preset}
              </button>
            );
          })}
        </div>
      </div>

      {fields.map((field, index) => {
        return (
          <div key={field.id} className="flex items-center gap-2">
            <div className="flex-1 space-y-1">
              <Input
                id={`extra-cost-${index}-concept`}
                placeholder="Concepto (ej. Seguro)"
                className="h-9 text-[13px]"
                {...register(`extraCosts.${index}.concept`)}
              />
              <FieldError
                message={errors.extraCosts?.[index]?.concept?.message}
              />
            </div>

            <div className="w-40 sm:w-48 space-y-1">
              <MoneyInput
                id={`extra-cost-${index}-amount`}
                min="0"
                placeholder="0"
                className="h-9 text-[13px]"
                value={watchedExtraCosts?.[index]?.amount ?? 0}
                onValueChange={(value) => setValue(`extraCosts.${index}.amount`, value ?? 0, { shouldValidate: true, shouldDirty: true })}
                ref={(element) => {
                  amountInputsRef.current[index] = element;
                }}
              />
              <FieldError
                message={errors.extraCosts?.[index]?.amount?.message}
              />
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
              onClick={() => onRemove(index)}
              aria-label="Eliminar costo adicional"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
