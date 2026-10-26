"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, Loader2, Sparkles, Tag, X } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { MoneyInput } from "@/components/ui/money-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScanButton } from "@/components/scanner";
import {
  CategoryAttributeFields,
  type AttributeValues,
} from "./category-attribute-fields";
import {
  lookupUpcAction,
  quickCreateProductAction,
  suggestProductFromImagesAction,
} from "@/app/actions/stock-count-actions";
import { resizeImageFile, type ResizedImage } from "@/lib/image-resize";
import { isUpcCandidate } from "@/lib/stock-count";
import type { CategoryAttribute } from "@/lib/validators/category-validator";
import type { ItemCondition } from "@/lib/validators/inventory-validator";
import type { UpcProductData } from "@/lib/upc-lookup";

export interface CountCategory {
  id: string;
  name: string;
  template: CategoryAttribute[];
}

interface QuickProductSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  countId: string;
  /** Código escaneado; null = mercancía sin código (se le asigna INT-XXXXXX). */
  code: string | null;
  condition: ItemCondition;
  categories: CountCategory[];
  onCreated: (result: { name: string; code: string }) => void;
}

const MAX_PHOTOS = 3;
const NONE = "__none__";

/** Las categorías de equipos (consolas) se cuentan con serial por defecto. */
const looksSerialized = (categoryName: string | undefined) =>
  !!categoryName && /consola/i.test(categoryName);

/**
 * Alta rápida de un producto que no está en el catálogo, sin salir del conteo.
 * Precarga datos del código (UPCitemdb) y permite completar la ficha con IA a
 * partir de fotos. El usuario siempre revisa antes de guardar.
 */
export const QuickProductSheet = ({
  open,
  onOpenChange,
  countId,
  code,
  condition,
  categories,
  onCreated,
}: QuickProductSheetProps) => {
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [attributes, setAttributes] = useState<AttributeValues>({});
  const [isSerialized, setIsSerialized] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [serial, setSerial] = useState("");
  const [unitCost, setUnitCost] = useState<number | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [photos, setPhotos] = useState<ResizedImage[]>([]);
  const [upcData, setUpcData] = useState<UpcProductData | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [aiPending, startAi] = useTransition();
  const [saving, startSave] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const category = categories.find((c) => c.id === categoryId);

  // Precarga desde la base pública de códigos (sólo UPC/EAN numéricos).
  useEffect(() => {
    if (!open || !code || !isUpcCandidate(code)) return;
    let cancelled = false;
    setLookingUp(true);
    lookupUpcAction(code)
      .then((data) => {
        if (cancelled || !data) return;
        setUpcData(data);
        setName((current) => current || data.name);
        setDescription((current) => current || data.description || "");
      })
      .finally(() => !cancelled && setLookingUp(false));
    return () => {
      cancelled = true;
    };
  }, [open, code]);

  // El color de UPCitemdb llena el atributo "color" si la categoría lo tiene.
  useEffect(() => {
    if (!upcData?.color || !category) return;
    if (!category.template.some((attr) => attr.key === "color")) return;
    setAttributes((current) =>
      current.color ? current : { ...current, color: upcData.color! },
    );
  }, [upcData, category]);

  const changeCategory = (value: string) => {
    const next = value === NONE ? null : value;
    setCategoryId(next);
    const nextCategory = categories.find((c) => c.id === next);
    setIsSerialized(looksSerialized(nextCategory?.name));
    // Conserva sólo los atributos que existan en la nueva categoría.
    const keys = new Set(nextCategory?.template.map((attr) => attr.key));
    setAttributes((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => keys.has(key))),
    );
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    try {
      const room = MAX_PHOTOS - photos.length;
      const resized = await Promise.all(
        Array.from(files).slice(0, room).map((file) => resizeImageFile(file)),
      );
      setPhotos((current) => [...current, ...resized]);
    } catch {
      toast.error("No se pudo leer la foto.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const fillWithAi = () =>
    startAi(async () => {
      const result = await suggestProductFromImagesAction({
        images: photos.map(({ mimeType, data }) => ({ mimeType, data })),
        upcHint: upcData
          ? {
              name: upcData.name,
              brand: upcData.brand ?? undefined,
              description: upcData.description ?? undefined,
            }
          : null,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      const suggestion = result.data;
      if (suggestion.categoryId) {
        setCategoryId(suggestion.categoryId);
        const suggested = categories.find((c) => c.id === suggestion.categoryId);
        setIsSerialized(looksSerialized(suggested?.name));
      }
      setName(suggestion.name);
      if (suggestion.description) setDescription(suggestion.description);
      setAttributes(suggestion.attributes);
      toast.success("Ficha sugerida. Revísala antes de guardar.");
    });

  const missing = [
    !name.trim() && "nombre",
    unitCost === null && "costo",
    price === null && "precio de venta",
    isSerialized && !serial.trim() && "serial",
  ].filter(Boolean) as string[];

  const save = () =>
    startSave(async () => {
      const result = await quickCreateProductAction({
        countId,
        code,
        categoryId,
        name: name.trim(),
        description: description.trim() || undefined,
        attributes,
        price: price ?? 0,
        unitCost: unitCost ?? 0,
        isSerialized,
        condition,
        quantity: isSerialized ? 1 : quantity,
        serials: isSerialized ? [serial.trim()] : undefined,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      onCreated({ name: result.data.product.name, code: result.data.code });
      onOpenChange(false);
    });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader className="border-b border-border">
          <SheetTitle>Producto nuevo</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            {code ? (
              <span className="mono rounded border border-border px-1.5 py-0.5 text-xs">
                {code}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs">
                <Tag className="h-3 w-3" /> Sin código: se le asignará uno interno para
                etiquetar
              </span>
            )}
            {lookingUp && (
              <span className="inline-flex items-center gap-1 text-xs">
                <Loader2 className="h-3 w-3 animate-spin" /> Buscando datos del código…
              </span>
            )}
            {upcData && !lookingUp && (
              <span className="text-xs text-[var(--tf-green)]">
                Datos encontrados por código
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 p-4">
          {/* Fotos → IA */}
          <section className="space-y-2 rounded-[10px] border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Llenar con foto</p>
              <span className="text-xs text-muted-foreground">
                {photos.length}/{MAX_PHOTOS}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {photos.map((photo, index) => (
                <div key={index} className="relative h-16 w-16 overflow-hidden rounded-md border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.previewUrl} alt={`Foto ${index + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    aria-label="Quitar foto"
                    className="absolute right-0.5 top-0.5 rounded-full bg-background/90 p-0.5"
                    onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-16 w-16 flex-col gap-1 text-[11px]"
                  onClick={() => fileRef.current?.click()}
                >
                  <Camera className="h-4 w-4" />
                  Foto
                </Button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                hidden
                onChange={(event) => addPhotos(event.target.files)}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={photos.length === 0 || aiPending}
              onClick={fillWithAi}
            >
              {aiPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {aiPending ? "Analizando…" : "Sugerir ficha con IA"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Toma el frente y la parte de atrás de la caja (con el modelo visible).
            </p>
          </section>

          <div className="space-y-1.5">
            <Label htmlFor="qp-category">Categoría</Label>
            <Select value={categoryId ?? NONE} onValueChange={changeCategory}>
              <SelectTrigger id="qp-category" className="w-full">
                <SelectValue placeholder="Sin categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin categoría</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qp-name">Nombre</Label>
            <Input
              id="qp-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej. Control DualSense PS5 Blanco"
            />
          </div>

          <CategoryAttributeFields
            template={category?.template ?? []}
            values={attributes}
            onChange={setAttributes}
          />

          <div className="space-y-1.5">
            <Label htmlFor="qp-description">Descripción</Label>
            <Textarea
              id="qp-description"
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Qué es, características, compatibilidad, qué incluye…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qp-cost">Costo unitario</Label>
              <MoneyInput id="qp-cost" value={unitCost} onValueChange={setUnitCost} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qp-price">Precio de venta</Label>
              <MoneyInput id="qp-price" value={price} onValueChange={setPrice} />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-[10px] border border-border p-3">
            <div>
              <Label htmlFor="qp-serialized">Lleva serial por unidad</Label>
              <p className="text-xs text-muted-foreground">
                Consolas y equipos. Accesorios y juegos normalmente no.
              </p>
            </div>
            <Switch id="qp-serialized" checked={isSerialized} onCheckedChange={setIsSerialized} />
          </div>

          {isSerialized ? (
            <div className="space-y-1.5">
              <Label htmlFor="qp-serial">Serial de esta unidad</Label>
              <div className="flex gap-2">
                <Input
                  id="qp-serial"
                  value={serial}
                  className="mono"
                  onChange={(event) => setSerial(event.target.value)}
                  placeholder="Escanea o escribe el serial"
                />
                <ScanButton
                  className="h-9 w-9 shrink-0"
                  title="Escanear serial"
                  onScan={(value) => {
                    setSerial(value);
                    return { status: "accepted", complete: true };
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Las demás unidades se agregan escaneando el código otra vez.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="qp-qty">Cantidad contada</Label>
              <Input
                id="qp-qty"
                type="number"
                inputMode="numeric"
                min={1}
                value={quantity}
                className="mono w-32"
                onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
              />
            </div>
          )}
        </div>

        <SheetFooter className="sticky bottom-0 border-t border-border bg-card">
          {missing.length > 0 && (
            <p className="text-xs text-muted-foreground">Falta: {missing.join(", ")}</p>
          )}
          <Button
            type="button"
            className="h-11 w-full"
            disabled={missing.length > 0 || saving}
            onClick={save}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar y seguir contando
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
