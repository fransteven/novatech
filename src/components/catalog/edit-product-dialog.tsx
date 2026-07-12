"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Edit } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { updateProductAction } from "@/app/actions/product-actions";
import { productSchema } from "@/lib/validators/product-validator";
import { ProductWithStock } from "@/services/product-service";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useState } from "react";

interface EditProductDialogProps {
  product: ProductWithStock & {
    sku?: string | null;
    categoryId?: string | null;
    warrantyMonths?: number | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProductDialog({ product, open, onOpenChange }: EditProductDialogProps) {
  const [categories, setCategories] = useState<
    { id: string; name: string; template: any }[]
  >([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      // Fetch categories when dialog opens
      import("@/app/actions/category-actions").then(
        ({ getCategoriesAction }) => {
          getCategoriesAction().then((result) => {
            if (result.success && result.data) {
              setCategories(result.data);
            }
          });
        },
      );
    }
  }, [open]);

  const form = useForm<z.infer<typeof productSchema>>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product.name,
      sku: product.sku || "",
      description: product.description || "",
      price: product.price?.toString() || "0",
      categoryId: product.categoryId || "",
      isSerialized: product.isSerialized,
      warrantyMonths: product.warrantyMonths ?? undefined,
      attributes: (product.attributes as Record<string, any>) || {},
    },
  });

  // Use useEffect to reset the form when the product changes or the dialog opens
  useEffect(() => {
    if (open && product && form) {
      form.reset({
        name: product.name,
        sku: product.sku || "",
        description: product.description || "",
        price: product.price?.toString() || "0",
        categoryId: product.categoryId || "",
        isSerialized: product.isSerialized,
        warrantyMonths: product.warrantyMonths ?? undefined,
        attributes: (product.attributes as Record<string, any>) || {},
      });
    }
  }, [open, product, form]);

  const selectedCategoryId = form.watch("categoryId");
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  function onSubmit(values: z.infer<typeof productSchema>) {
    startTransition(async () => {
      const result = await updateProductAction(product.id, values);
      if (result.success) {
        toast.success("Producto actualizado exitosamente");
        onOpenChange(false);
      } else {
        toast.error(result.error || "Error al actualizar el producto");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Producto</DialogTitle>
          <DialogDescription>
            Modifica los detalles del producto seleccionado.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="iPhone 15 Pro" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sku"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código de Barras (Opcional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Escanear código de fábrica o dejar vacío"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Para accesorios, escanea el código de la caja. Si lo dejas
                    vacío, el sistema generará uno.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar categoría" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedCategory &&
              selectedCategory.template &&
              (selectedCategory.template as any[]).map((attr: any) => (
                <FormField
                  key={attr.key}
                  control={form.control}
                  name={`attributes.${attr.key}`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{attr.label}</FormLabel>
                      <FormControl>
                        {attr.type === "select" ? (
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={`Seleccionar ${attr.label}`}
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {attr.options?.map((opt: string) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : attr.type === "number" ? (
                          <Input
                            type="number"
                            placeholder={attr.label}
                            {...field}
                            value={field.value ?? ""}
                          />
                        ) : (
                          <Input
                            placeholder={attr.label}
                            {...field}
                            value={field.value ?? ""}
                          />
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descripción detallada..."
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Precio de Venta (COP)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="0.00"
                      {...field}
                      min="0"
                      step="0.01"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="warrantyMonths"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Meses de Garantía</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Ej: 12 para iPhone nuevo"
                      min="0"
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === "" ? undefined : Number(e.target.value),
                        )
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    Meses de cobertura desde la entrega. Si se deja vacío, se
                    usa el periodo por defecto de la tienda.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isSerialized"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      ¿Es Serializado?
                    </FormLabel>
                    <FormDescription>
                      Identificado por serial/IMEI único.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
