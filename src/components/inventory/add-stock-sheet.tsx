"use client";

import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { receiveStockAction } from "@/app/actions/inventory-actions";
import { getOwnersAction, createOwnerAction } from "@/app/actions/owner-actions";
import { ProductWithStock } from "@/services/product-service";

import { PrintLabelsDialog, PrintData } from "./print-labels-dialog";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AddStockSheetProps {
  products: ProductWithStock[];
}

// Dynamic schema based on product type
const createFormSchema = (isSerialized: boolean) => {
  const baseSchema = z.object({
    productId: z.string().min(1, "Seleccione un producto."),
    quantity: z.coerce
      .number()
      .int()
      .positive("La cantidad debe ser positiva."),
    unitCost: z.coerce.number().min(0, "El costo debe ser positivo o cero."),
    serials: isSerialized
      ? z.array(z.string().min(1, "El IMEI no puede estar vacío"))
      : z.array(z.string()).optional(),
    batteryHealth: z.coerce.number().min(1).max(100).optional(),
    notes: z.string().optional(),
    ownerType: z.enum(["masterplay", "consignment"]).default("masterplay"),
    ownerId: z.string().optional(),
  });

  return baseSchema.refine(
    (data) => {
      if (data.ownerType === "consignment" && isSerialized) {
        return !!data.ownerId && data.ownerId.trim().length > 0 && data.ownerId !== "masterplay";
      }
      return true;
    },
    {
      message: "El propietario es requerido.",
      path: ["ownerId"],
    },
  );
};

type FormValues = z.infer<ReturnType<typeof createFormSchema>>;

export function AddStockSheet({ products }: AddStockSheetProps) {
  const [open, setOpen] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printData, setPrintData] = useState<PrintData | null>(null);
  const [selectedProduct, setSelectedProduct] =
    useState<ProductWithStock | null>(null);
  const [imeiCount, setImeiCount] = useState(0);

  const [owners, setOwners] = useState<{ id: string; name: string }[]>([]);
  const [isCreatingOwner, setIsCreatingOwner] = useState(false);
  const [newOwnerName, setNewOwnerName] = useState("");

  useEffect(() => {
    async function fetchOwners() {
      const res = await getOwnersAction();
      if (res.success && res.data) {
        setOwners(res.data);
      }
    }
    if (open) {
      fetchOwners();
    }
  }, [open]);

  const handleCreateOwner = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!newOwnerName.trim()) return;
    setIsCreatingOwner(true);
    const res = await createOwnerAction({ name: newOwnerName });
    if (res.success && res.data) {
      setOwners([res.data, ...owners]);
      form.setValue("ownerType", "consignment");
      form.setValue("ownerId", res.data.id);
      setNewOwnerName("");
      toast.success("Propietario creado exitosamente");
    } else {
      toast.error(res.error || "Error al crear propietario");
    }
    setIsCreatingOwner(false);
  };

  const form = useForm<any>({
    resolver: zodResolver(
      createFormSchema(selectedProduct?.isSerialized ?? false),
    ),
    defaultValues: {
      productId: "",
      quantity: "",
      unitCost: "",
      serials: [],
      ownerType: "masterplay",
      ownerId: "masterplay",
    },
  });

  async function onSubmit(values: FormValues) {
    // Validation for serialized products
    if (selectedProduct?.isSerialized) {
      const filledSerials =
        values.serials?.filter((s) => s && s.trim().length > 0) || [];
      if (filledSerials.length !== values.quantity) {
        toast.error("Error de validación", {
          description: `Debe ingresar exactamente ${values.quantity} IMEIs.`,
        });
        return;
      }
    }

    const result = await receiveStockAction({
      productId: values.productId,
      quantity: values.quantity,
      unitCost: values.unitCost,
      serials: selectedProduct?.isSerialized ? values.serials : undefined,
      batteryHealth: selectedProduct?.isSerialized ? values.batteryHealth : undefined,
      notes: selectedProduct?.isSerialized ? values.notes : undefined,
      ownerType: selectedProduct?.isSerialized
        ? values.ownerType
        : "masterplay",
      ownerId:
        selectedProduct?.isSerialized && values.ownerType === "consignment" && values.ownerId !== "masterplay"
          ? values.ownerId
          : undefined,
    });

    if (result.success) {
      toast.success("Entrada registrada", {
        description: `Se agregaron ${values.quantity} unidad(es) al inventario.`,
      });
      setOpen(false);

      // Prepare print data
      if (result.type === "serialized") {
        setPrintData({
          type: "serialized",
          productName: selectedProduct?.name || "Producto Genérico",
          items: result.items,
          price: selectedProduct?.price || 0,
        });
      } else if (result.type === "generic") {
        setPrintData({
          type: "generic",
          product: result.product,
          quantity: result.quantity || values.quantity,
          price: selectedProduct?.price || 0,
        });
      }

      setPrintDialogOpen(true);

      form.reset();
      setSelectedProduct(null);
      setImeiCount(0);
    } else {
      toast.error("Error al registrar entrada", {
        description: result.error,
      });
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            size="lg"
            className="h-[38px] px-[14px] text-[13.5px] font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
            style={{ boxShadow: "0 1px 0 inset oklch(1 0 0 / 0.2), var(--tf-shadow-sm), 0 4px 12px var(--tf-accent-ring)" }}
          >
            <Plus className="mr-2 h-4 w-4" strokeWidth={2.25} />
            Registrar Ingreso
          </Button>
        </SheetTrigger>
        <SheetContent className="flex flex-col overflow-y-auto sm:max-w-lg p-0 bg-card border-l border-border">
          <SheetHeader className="px-6 pt-[22px] pb-[18px] border-b border-border">
            <SheetTitle className="text-[18px] font-bold tracking-[-0.02em]">Registrar Entrada / Compra</SheetTitle>
            <SheetDescription className="text-[13px] text-[color:var(--tf-fg-muted)] max-w-[380px]">
              Registra la entrada de mercancía a la bodega. Los campos se
              ajustan según el tipo de producto.
            </SheetDescription>
          </SheetHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-4 px-6 py-5 flex-1"
            >
              {/* Paso 1: Selección del Producto */}
              <FormField
                control={form.control}
                name="productId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Producto *</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        const product = products.find((p) => p.id === value);
                        setSelectedProduct(product || null);
                        setImeiCount(0);
                        form.setValue("quantity", "");
                        form.setValue("serials", []);
                        form.setValue("ownerType", "masterplay");
                        form.setValue("ownerId", "masterplay");
                      }}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Buscar y seleccionar producto..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {products.map((product) => {
                          const attrs = product.attributes as Record<string, string> | null;
                          const attrValues = attrs ? Object.values(attrs).filter(Boolean) : [];
                          return (
                            <SelectItem key={product.id} value={product.id}>
                              <span className="flex flex-col">
                                <span>
                                  {product.name}
                                  {product.isSerialized && " (Serializado)"}
                                </span>
                                {attrValues.length > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    {attrValues.join(" · ")}
                                  </span>
                                )}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Paso 2: Inputs Básicos */}
              {selectedProduct && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="quantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cantidad *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              placeholder="Ej: 3"
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                const val = parseInt(e.target.value);
                                setImeiCount(isNaN(val) ? 0 : val);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="unitCost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {selectedProduct.isSerialized &&
                            form.watch("ownerType") === "consignment"
                              ? "Costo Base *"
                              : "Costo Unitario *"}
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="$0.00"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Condición del Equipo (Solo para serializados) */}
                  {selectedProduct.isSerialized && (
                    <div className="space-y-4 border border-border rounded-[10px] p-3 bg-muted/30">
                      <h4 className="font-medium text-sm border-b border-border pb-2">Condición de la Instancia</h4>
                      <div className="grid grid-cols-1 gap-4">
                        <FormField
                          control={form.control}
                          name="batteryHealth"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Salud de Batería (%)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="Ej: 95"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>Dejar vacío si no aplica</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="notes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Notas de Estado</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Ej: Pantalla cambiada, rayón en marco..."
                                  className="resize-none"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}

                  {/* Consignment / Ownership Selection */}
                  {selectedProduct.isSerialized && (
                    <div className="space-y-4 border border-border rounded-[10px] p-3">
                      <FormField
                        control={form.control}
                        name="ownerId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Propietario *</FormLabel>
                            <Select
                              onValueChange={(val) => {
                                field.onChange(val);
                                form.setValue("ownerType", val === "masterplay" ? "masterplay" : "consignment");
                              }}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccionar..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="masterplay">Propio (Masterplay)</SelectItem>
                                {owners.map((owner) => (
                                  <SelectItem key={owner.id} value={owner.id}>
                                    {owner.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex gap-2 pt-2 border-t">
                        <Input
                          placeholder="Nombre nuevo propietario"
                          value={newOwnerName}
                          onChange={(e) => setNewOwnerName(e.target.value)}
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={handleCreateOwner}
                          disabled={isCreatingOwner || !newOwnerName.trim()}
                        >
                          {isCreatingOwner ? "Creando..." : "Crear"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Paso 3: Campos Dinámicos de IMEI (Solo para productos serializados) */}
                  {selectedProduct.isSerialized && imeiCount > 0 && (
                    <div className="space-y-3 border-t pt-4">
                      <div className="space-y-1">
                        <h4 className="font-medium text-sm">
                          Seriales / IMEIs ({imeiCount} requeridos)
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Puede usar el lector de código de barras en cada campo
                        </p>
                      </div>
                      {Array.from({ length: imeiCount }).map((_, index) => (
                        <FormField
                          key={index}
                          control={form.control}
                          name={`serials.${index}`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>IMEI #{index + 1}</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder={`Escanear o escribir IMEI #${index + 1}`}
                                  autoFocus={index === 0}
                                  {...field}
                                  value={field.value || ""}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                  )}

                  {/* Info para productos NO serializados */}
                  {!selectedProduct.isSerialized && (
                    <div className="rounded-md bg-muted p-3 text-sm">
                      <p className="text-muted-foreground">
                        Este producto no requiere seriales. Solo ingrese la
                        cantidad y el costo unitario.
                      </p>
                    </div>
                  )}
                </>
              )}

              <SheetFooter className="pt-4 flex gap-[10px] justify-end border-t border-border mt-2 pb-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-[color:var(--tf-fg-muted)] hover:text-foreground"
                  onClick={() => setOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={!selectedProduct}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                >
                  Confirmar ingreso
                </Button>
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      <PrintLabelsDialog
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        data={printData}
      />
    </>
  );
}
