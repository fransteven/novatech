"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";

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
import { createProductAction } from "@/app/actions/product-actions";
import { productSchema } from "@/lib/validators/product-validator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useState } from "react";

export function CreateProductDialog() {
  const [open, setOpen] = useState(false);
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
      name: "",
      sku: "",
      description: "",
      price: "0",
      categoryId: "",
      isSerialized: false,
      attributes: {},
    },
  });

  const selectedCategoryId = form.watch("categoryId");
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  function onSubmit(values: z.infer<typeof productSchema>) {
    startTransition(async () => {
      const result = await createProductAction(values);
      if (result.success) {
        toast.success("Producto creado exitosamente");
        setOpen(false);
        form.reset();
      } else {
        toast.error(result.error || "Error al crear el producto");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Producto
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Producto</DialogTitle>
          <DialogDescription>
            Ingresa los detalles del nuevo producto.
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
              <Button type="submit" disabled={isPending}>
                {isPending ? "Guardando..." : "Guardar Producto"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
