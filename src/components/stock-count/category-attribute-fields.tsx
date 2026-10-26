"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CategoryAttribute } from "@/lib/validators/category-validator";

export type AttributeValues = Record<string, string | number>;

interface CategoryAttributeFieldsProps {
  template: CategoryAttribute[];
  values: AttributeValues;
  onChange: (values: AttributeValues) => void;
  disabled?: boolean;
}

/** Campos dinámicos de la categoría (color, plataforma, franquicia…), controlados. */
export const CategoryAttributeFields = ({
  template,
  values,
  onChange,
  disabled,
}: CategoryAttributeFieldsProps) => {
  if (template.length === 0) return null;

  const set = (key: string, value: string | number | null) => {
    const next = { ...values };
    if (value === null || value === "") delete next[key];
    else next[key] = value;
    onChange(next);
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {template.map((attr) => {
        const id = `attr-${attr.key}`;
        const current = values[attr.key];
        return (
          <div key={attr.key} className="space-y-1.5">
            <Label htmlFor={id}>{attr.label}</Label>
            {attr.type === "select" ? (
              <Select
                value={current === undefined ? "" : String(current)}
                onValueChange={(value) => set(attr.key, value)}
                disabled={disabled}
              >
                <SelectTrigger id={id} className="w-full">
                  <SelectValue placeholder={`Seleccionar ${attr.label.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  {attr.options?.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id={id}
                type={attr.type === "number" ? "number" : "text"}
                inputMode={attr.type === "number" ? "decimal" : undefined}
                value={current ?? ""}
                disabled={disabled}
                placeholder={attr.label}
                onChange={(event) =>
                  set(
                    attr.key,
                    attr.type === "number" && event.target.value !== ""
                      ? Number(event.target.value)
                      : event.target.value,
                  )
                }
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
