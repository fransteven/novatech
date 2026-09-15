"use client";

import { useState, useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  createImportCostSchema,
  CreateImportCostInput,
  CONDITION_OPTIONS,
} from "@/lib/validators/import-cost-validator";
import { createImportCostAction } from "@/app/actions/import-cost-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Cpu } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

// Attribute definition from categories.template
interface AttributeDef {
  key: string;
  label: string;
  type: "select" | "text";
  options?: string[];
}

interface Product {
  id: string;
  name: string;
  price: string;
  attributes: Record<string, string> | null;
  categoryTemplate: AttributeDef[] | null;
}

interface CreateImportCostDialogProps {
  products: Product[];
}

const MASTERCARD_RATE = 0.0045;

export function CreateImportCostDialog({
  products,
}: CreateImportCostDialogProps) {
  const [open, setOpen] = useState(false);
  const [specs, setSpecs] = useState<Record<string, string>>({});

  const form = useForm<CreateImportCostInput>({
    resolver: zodResolver(
      createImportCostSchema,
    ) as unknown as Resolver<CreateImportCostInput>,
    defaultValues: {
      purchaseDate: new Date(),
      status: "cotizacion" as const,
      useMastercardNu: false,
      baseUsdCost: 0,
      mastercardDollarRate: null,
      casilleroUsdCost: 50,
      casilleroTrm: 0,
      productTrm: 0,
      customsTariffPesos: 0,
      provider: "",
      notes: "",
    },
  });

  const watchedValues = form.watch();
  const selectedProductId = watchedValues.productId;
  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const catalogPrice = selectedProduct ? parseFloat(selectedProduct.price) : 0;

  // Category template for the selected product
  const categoryTemplate =
    (selectedProduct?.categoryTemplate as AttributeDef[] | null) ?? null;

  // Pre-fill specs from product.attributes when product changes
  useEffect(() => {
    if (!selectedProduct) {
      setSpecs({});
      return;
    }
    const attrs =
      (selectedProduct.attributes as Record<string, string> | null) ?? {};
    setSpecs(attrs);
  }, [selectedProductId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Computed preview values
  const baseUsd = watchedValues.baseUsdCost ?? 0;
  const useMastercard = watchedValues.useMastercardNu;
  const mastercardTrm = watchedValues.mastercardDollarRate ?? 0;
  const casilleroUsd = watchedValues.casilleroUsdCost ?? 50;
  const casilleroTrm = watchedValues.casilleroTrm ?? 0;
  const productTrm = watchedValues.productTrm ?? 0;
  const customsTariff = watchedValues.customsTariffPesos ?? 0;

  const mastercardPesos = useMastercard
    ? baseUsd * MASTERCARD_RATE * mastercardTrm
    : 0;
  const casilleroPesos = casilleroUsd * casilleroTrm;
  const productPesos = baseUsd * productTrm;
  const totalCost =
    mastercardPesos + casilleroPesos + productPesos + customsTariff;
  const estimatedMargin = catalogPrice > 0 ? catalogPrice - totalCost : null;

  const handleReset = () => {
    form.reset();
    setSpecs({});
  };

  const onSubmit = async (data: CreateImportCostInput) => {
    const result = await createImportCostAction({
      ...data,
      specs: Object.keys(specs).length > 0 ? specs : null,
    });

    if (result.success) {
      toast.success("Costeo registrado exitosamente");
      setOpen(false);
      handleReset();
    } else {
      toast.error(result.error as string);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) handleReset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Registrar Importación
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Costeo de Importación</DialogTitle>
          <DialogDescription>
            Registra el costo detallado de traer un equipo desde EE.UU.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Sección: Información del equipo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="productId"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Dispositivo</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un producto del catálogo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Especificaciones dinámicas — aparecen cuando el producto tiene template */}
              {categoryTemplate && categoryTemplate.length > 0 && (
                <div className="md:col-span-2 space-y-3 rounded-lg border border-border bg-muted p-4">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-semibold text-foreground">
                      Especificaciones de la unidad
                    </h4>
                    <span className="text-[11px] text-muted-foreground">
                      (pre-rellenado desde catálogo — ajusta si la unidad difiere)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {categoryTemplate.map((attr) => (
                      <div key={attr.key} className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">
                          {attr.label}
                        </label>
                        {attr.type === "select" && attr.options?.length ? (
                          <Select
                            value={specs[attr.key] ?? ""}
                            onValueChange={(val) =>
                              setSpecs((prev) => ({ ...prev, [attr.key]: val }))
                            }
                          >
                            <SelectTrigger className="bg-background">
                              <SelectValue
                                placeholder={`Selecciona ${attr.label.toLowerCase()}`}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {attr.options.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            className="bg-background"
                            placeholder={attr.label}
                            value={specs[attr.key] ?? ""}
                            onChange={(e) =>
                              setSpecs((prev) => ({
                                ...prev,
                                [attr.key]: e.target.value,
                              }))
                            }
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <FormField
                control={form.control}
                name="provider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proveedor</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Amazon, eBay, Swappa…"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="cotizacion">Cotización</SelectItem>
                        <SelectItem value="comprado">Comprado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="purchaseDate"
                render={({ field }) => {
                  const toLocalDateString = (v: unknown): string => {
                    if (!v) return "";
                    const d = v instanceof Date ? v : new Date(String(v));
                    if (isNaN(d.getTime())) return "";
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, "0");
                    const day = String(d.getDate()).padStart(2, "0");
                    return `${y}-${m}-${day}`;
                  };
                  return (
                    <FormItem>
                      <FormLabel>Fecha de Compra</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          value={toLocalDateString(field.value)}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (!val) return;
                            const [y, mo, d] = val.split("-").map(Number);
                            const parsed = new Date(y, mo - 1, d);
                            if (!isNaN(parsed.getTime())) {
                              field.onChange(parsed);
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="condition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Condición</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona condición" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CONDITION_OPTIONS.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Sección: Costo base */}
            <div>
              <h4 className="mb-3 text-sm font-medium text-muted-foreground">
                Costo del Equipo
              </h4>
              <FormField
                control={form.control}
                name="baseUsdCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Costo antes de impuestos (USD)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Sección: Comisión Mastercard Nu */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <FormField
                  control={form.control}
                  name="useMastercardNu"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="cursor-pointer">
                        Pagado con tarjeta Mastercard Nu
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              {watchedValues.useMastercardNu && (
                <div className="grid grid-cols-1 gap-4 border-l-2 border-border pl-2 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="mastercardDollarRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>TRM NuBank (pesos por dólar)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="4200.00"
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value === ""
                                  ? null
                                  : parseFloat(e.target.value) || null,
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex items-end pb-2">
                    <div className="text-sm">
                      <p className="text-muted-foreground">Comisión (0.45%)</p>
                      <p className="font-semibold">
                        {formatCurrency(mastercardPesos)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sección: Casillero */}
            <div>
              <h4 className="mb-3 text-sm font-medium text-muted-foreground">
                Casillero (servicio de envío)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="casilleroUsdCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor casillero (USD)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="50.00"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 50)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="casilleroTrm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dólar casillero (TRM)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="4200.00"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex items-end pb-2">
                  <div className="text-sm">
                    <p className="text-muted-foreground">Pesos casillero</p>
                    <p className="font-semibold">{formatCurrency(casilleroPesos)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sección: Dólar producto */}
            <div>
              <h4 className="mb-3 text-sm font-medium text-muted-foreground">
                Dólar del producto
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="productTrm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dólar producto (TRM)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="4250.00"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex items-end pb-2">
                  <div className="text-sm">
                    <p className="text-muted-foreground">Pesos producto</p>
                    <p className="font-semibold">{formatCurrency(productPesos)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Aranceles */}
            <FormField
              control={form.control}
              name="customsTariffPesos"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Aranceles DIAN (COP)</FormLabel>
                  <FormControl>
                    <MoneyInput
                      placeholder="0"
                      value={typeof field.value === "number" ? field.value : Number(field.value) || null}
                      onBlur={field.onBlur}
                      onValueChange={(value) => field.onChange(value ?? 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Resumen de costos */}
            <Card className="border-border bg-card">
              <CardContent className="pt-4 space-y-2">
                <h4 className="text-sm font-semibold text-foreground">
                  Resumen de Costeo
                </h4>

                {/* Specs preview */}
                {Object.keys(specs).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 border-b border-border pb-2">
                    {Object.entries(specs).map(([key, val]) =>
                      val ? (
                        <Badge
                          key={key}
                          variant="secondary"
                          className="bg-accent text-accent-foreground border-primary/20 text-[11px]"
                        >
                          {val}
                        </Badge>
                      ) : null,
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-1 text-sm">
                  <span className="text-muted-foreground">Comisión Mastercard</span>
                  <span className="text-right">{formatCurrency(mastercardPesos)}</span>

                  <span className="text-muted-foreground">Casillero</span>
                  <span className="text-right">{formatCurrency(casilleroPesos)}</span>

                  <span className="text-muted-foreground">Equipo (pesos)</span>
                  <span className="text-right">{formatCurrency(productPesos)}</span>

                  {customsTariff > 0 && (
                    <>
                      <span className="text-muted-foreground">Aranceles DIAN</span>
                      <span className="text-right">
                        {formatCurrency(customsTariff)}
                      </span>
                    </>
                  )}

                  <span className="border-t border-border pt-1 font-semibold">
                    Costo Total
                  </span>
                  <span className="border-t border-border pt-1 text-right font-semibold">
                    {formatCurrency(totalCost)}
                  </span>

                  {estimatedMargin !== null && catalogPrice > 0 && (
                    <>
                      <span className="text-muted-foreground">Precio catálogo</span>
                      <span className="text-right">
                        {formatCurrency(catalogPrice)}
                      </span>
                      <span
                        className={
                          estimatedMargin >= 0
                            ? "font-medium text-[color:var(--tf-green)]"
                            : "font-medium text-[color:var(--tf-red)]"
                        }
                      >
                        Margen estimado
                      </span>
                      <span
                        className={`text-right font-medium ${estimatedMargin >= 0 ? "text-[color:var(--tf-green)]" : "text-[color:var(--tf-red)]"}`}
                      >
                        {formatCurrency(estimatedMargin)} (
                        {((estimatedMargin / catalogPrice) * 100).toFixed(1)}%)
                      </span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Notas */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ej: Casillero compartido con 2 equipos, batería al 89%…"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting
                ? "Registrando…"
                : "Registrar Costeo"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
