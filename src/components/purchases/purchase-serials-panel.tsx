"use client";

import { useEffect, useRef } from "react";
import type {
  FieldErrors,
  UseFormGetValues,
  UseFormRegister,
  UseFormSetValue,
} from "react-hook-form";
import type { CreatePurchaseSchema } from "@/lib/validators/purchase-validator";
import { normalizeSerial } from "@/lib/serials";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_CONDITION_WARRANTY,
  ITEM_CONDITIONS,
  ITEM_CONDITION_LABELS,
  WARRANTY_MONTH_PRESETS,
  type ItemCondition,
} from "@/lib/validators/inventory-validator";
import type { ConditionAttributeDef } from "@/lib/condition-attributes";
import { ScanButton } from "@/components/scanner/scan-button";
import { processBatchSerial } from "@/lib/camera/batch-serial-helper";

interface PurchaseSerialsPanelProps {
  lineIndex: number;
  quantity: number;
  serialNumbers: string[];
  /** Condición con la que entra la mercancía de esta línea. */
  condition: ItemCondition;
  /** Meses de garantía pactados para mercancía no nueva. */
  warrantyMonths: number | null;
  /** Métricas de condición propias de la categoría del producto. */
  conditionAttributes: ConditionAttributeDef[];
  duplicateSerials: Set<string>;
  register: UseFormRegister<CreatePurchaseSchema>;
  errors: FieldErrors<CreatePurchaseSchema>;
  setValue: UseFormSetValue<CreatePurchaseSchema>;
  getValues: UseFormGetValues<CreatePurchaseSchema>;
  isOpen: boolean;
  optionalNumberField: { setValueAs: (v: unknown) => number | undefined };
}

const FieldError = ({ message }: { message?: string }) =>
  message ? <p className="text-destructive text-xs">{message}</p> : null;

export function PurchaseSerialsPanel({
  lineIndex,
  quantity,
  serialNumbers,
  condition,
  warrantyMonths,
  conditionAttributes,
  duplicateSerials,
  register,
  errors,
  setValue,
  getValues,
  isOpen,
  optionalNumberField,
}: PurchaseSerialsPanelProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  // Primer atributo de condición: destino del Enter tras el último serial.
  const firstAttributeRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      const current = getValues(`details.${lineIndex}.serialNumbers`) ?? [];
      const firstEmptyIndex = current.findIndex(
        (s: string) => !s || !s.trim(),
      );
      const targetIndex = firstEmptyIndex >= 0 ? firstEmptyIndex : 0;
      const timer = setTimeout(() => {
        inputRefs.current[targetIndex]?.focus();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isOpen, lineIndex, getValues]);

  const handleSerialPaste = (
    event: React.ClipboardEvent<HTMLInputElement>,
    serialIndex: number,
  ) => {
    const text = event.clipboardData.getData("text");
    const pasted = text
      .split(/[\s,;]+/)
      .map((value) => value.trim())
      .filter(Boolean);

    if (pasted.length <= 1) return;

    event.preventDefault();
    const current = getValues(`details.${lineIndex}.serialNumbers`) ?? [];
    const next = [...current];
    pasted.forEach((serial, offset) => {
      next[serialIndex + offset] = serial;
    });

    setValue(`details.${lineIndex}.serialNumbers`, next, {
      shouldValidate: true,
      shouldDirty: true,
    });
    if (next.length > quantity) {
      setValue(`details.${lineIndex}.quantity`, next.length, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    serialIndex: number,
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (serialIndex + 1 < quantity) {
        inputRefs.current[serialIndex + 1]?.focus();
      } else {
        firstAttributeRef.current?.focus();
      }
    }
  };

  const handleContinuousScan = (scannedValue: string) => {
    const current = (getValues(`details.${lineIndex}.serialNumbers`) as string[]) || [];
    const result = processBatchSerial({
      scannedValue,
      currentSerials: current,
      targetQuantity: quantity,
      existingSerialsSet: duplicateSerials,
    });

    if (result.decision.status === "accepted") {
      setValue(`details.${lineIndex}.serialNumbers`, result.nextSerials, {
        shouldValidate: true,
        shouldDirty: true,
      });

      if (result.filledIndex + 1 < quantity) {
        inputRefs.current[result.filledIndex + 1]?.focus();
      } else {
        firstAttributeRef.current?.focus();
      }
    }
    return result.decision;
  };

  const handleSingleScan = (scannedValue: string, serialIndex: number) => {
    const current = (getValues(`details.${lineIndex}.serialNumbers`) as string[]) || [];
    const result = processBatchSerial({
      scannedValue,
      currentSerials: current,
      targetQuantity: quantity,
      targetIndex: serialIndex,
      existingSerialsSet: duplicateSerials,
    });

    if (result.decision.status === "accepted") {
      setValue(`details.${lineIndex}.serialNumbers`, result.nextSerials, {
        shouldValidate: true,
        shouldDirty: true,
      });

      if (serialIndex + 1 < quantity) {
        inputRefs.current[serialIndex + 1]?.focus();
      } else {
        firstAttributeRef.current?.focus();
      }
    }
    return result.decision;
  };

  return (
    <div className="space-y-3 border-t border-border pt-3 mt-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label
            htmlFor={`detail-${lineIndex}-serial-0`}
            className="text-[12px] font-semibold text-muted-foreground"
          >
            Seriales / IMEI ({quantity} requerido{quantity === 1 ? "" : "s"})
          </Label>
          <ScanButton
            mode="continuous"
            enableImeiOcr={true}
            title={`Compra Lote: Línea #${lineIndex + 1} (${quantity} seriales)`}
            description="Llena automáticamente el siguiente campo vacío"
            onScan={handleContinuousScan}
            variant="outline"
            size="sm"
            className="h-6 text-[11px] px-2 gap-1 font-semibold"
          >
            <span>Escanear lote</span>
          </ScanButton>
        </div>
        <span className="text-[11px] text-muted-foreground hidden sm:inline">
          Presiona Enter para avanzar · Puedes pegar varios separados por coma
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {Array.from({ length: quantity }).map((_, serialIndex) => {
          const value = serialNumbers?.[serialIndex] ?? "";
          const isDuplicate =
            Boolean(value) &&
            duplicateSerials.has(normalizeSerial(String(value)));
          const serialRegistration = register(
            `details.${lineIndex}.serialNumbers.${serialIndex}`,
          );

          return (
            <div key={serialIndex} className="space-y-1">
              <div className="flex items-center gap-1">
                <Input
                  id={`detail-${lineIndex}-serial-${serialIndex}`}
                  placeholder={`IMEI #${serialIndex + 1}`}
                  aria-invalid={isDuplicate}
                  className={
                    isDuplicate
                      ? "border-destructive font-mono text-[13px] h-8"
                      : "font-mono text-[13px] h-8"
                  }
                  {...serialRegistration}
                  ref={(element) => {
                    serialRegistration.ref(element);
                    inputRefs.current[serialIndex] = element;
                  }}
                  onPaste={(event) => handleSerialPaste(event, serialIndex)}
                  onKeyDown={(event) => handleKeyDown(event, serialIndex)}
                />
                <ScanButton
                  mode="single"
                  enableImeiOcr={true}
                  title={`Línea #${lineIndex + 1} - IMEI #${serialIndex + 1}`}
                  onScan={(val) => handleSingleScan(val, serialIndex)}
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  aria-label={`Escanear IMEI #${serialIndex + 1}`}
                />
              </div>
              {isDuplicate && (
                <p className="text-destructive text-[11px] leading-none">
                  Serial repetido en esta compra
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Metadatos de condición física */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
        <div className="space-y-1">
          <Label className="text-[11.5px] text-muted-foreground">
            Condición
          </Label>
          <Select
            value={condition}
            onValueChange={(value) => {
              setValue(`details.${lineIndex}.condition`, value as ItemCondition, {
                shouldDirty: true,
              });
              // Preselecciona la cobertura de la casa para esa condición.
              setValue(
                `details.${lineIndex}.warrantyMonths`,
                DEFAULT_CONDITION_WARRANTY[value as ItemCondition] as
                  | 1
                  | 3
                  | 6
                  | null,
                { shouldDirty: true },
              );
            }}
          >
            <SelectTrigger className="h-8 text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ITEM_CONDITIONS.map((value) => (
                <SelectItem key={value} value={value}>
                  {ITEM_CONDITION_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {condition !== "new" && (
          <div className="space-y-1">
            <Label className="text-[11.5px] text-muted-foreground">
              Garantía de la unidad
            </Label>
            <Select
              value={warrantyMonths ? String(warrantyMonths) : ""}
              onValueChange={(value) =>
                setValue(
                  `details.${lineIndex}.warrantyMonths`,
                  Number(value) as 1 | 3 | 6,
                  { shouldDirty: true },
                )
              }
            >
              <SelectTrigger className="h-8 text-[13px]">
                <SelectValue placeholder="Meses" />
              </SelectTrigger>
              <SelectContent>
                {WARRANTY_MONTH_PRESETS.map((months) => (
                  <SelectItem key={months} value={String(months)}>
                    {months} {months === 1 ? "mes" : "meses"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {conditionAttributes.map((attribute, attributeIndex) => {
          const registration = register(
            `details.${lineIndex}.conditionDetails.${attribute.key}`,
            optionalNumberField,
          );

          return (
            <div key={attribute.key} className="space-y-1">
              <Label
                htmlFor={`detail-${lineIndex}-${attribute.key}`}
                className="text-[11.5px] text-muted-foreground"
              >
                {attribute.label}
              </Label>
              <Input
                id={`detail-${lineIndex}-${attribute.key}`}
                type="number"
                min={attribute.min}
                max={attribute.max}
                placeholder={attribute.placeholder}
                className="h-8 text-[13px] font-mono"
                {...registration}
                ref={(element) => {
                  registration.ref(element);
                  if (attributeIndex === 0) firstAttributeRef.current = element;
                }}
              />
              <FieldError
                message={
                  errors.details?.[lineIndex]?.conditionDetails?.[attribute.key]
                    ?.message
                }
              />
            </div>
          );
        })}

        <div className="space-y-1">
          <Label
            htmlFor={`detail-${lineIndex}-notes`}
            className="text-[11.5px] text-muted-foreground"
          >
            Notas de condición
          </Label>
          <Input
            id={`detail-${lineIndex}-notes`}
            placeholder="Ej. rayón en marco"
            className="h-8 text-[13px]"
            {...register(`details.${lineIndex}.notes`)}
          />
        </div>
      </div>
    </div>
  );
}
