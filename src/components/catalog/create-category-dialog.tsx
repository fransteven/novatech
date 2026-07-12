"use client";

import { useTransition, useState } from "react";
import { useForm, useFieldArray, useWatch, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Plus, Trash2, FolderPlus, X } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCategoryAction } from "@/app/actions/category-actions";
import {
  categorySchema,
  type CategoryInput,
} from "@/lib/validators/category-validator";
import { Badge } from "@/components/ui/badge";

// Removed manual type definition to use inferred type from schema

function SelectOptionsEditor({
  control,
  index,
}: {
  control: Control<CategoryInput>;
  index: number;
}) {
  const [draft, setDraft] = useState("");

  return (
    <FormField
      control={control}
      name={`template.${index}.options`}
      render={({ field }) => {
        const options: string[] = field.value ?? [];

        function addOption() {
          const value = draft.trim();
          if (!value || options.includes(value)) {
            setDraft("");
            return;
          }
          field.onChange([...options, value]);
          setDraft("");
        }

        return (
          <FormItem className="col-span-2">
            <FormLabel className="text-xs">Opciones</FormLabel>
            <FormControl>
              <Input
                placeholder="Ej: 4GB, 8GB, 16GB..."
                className="h-8 text-sm"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addOption();
                  }
                }}
                onBlur={addOption}
              />
            </FormControl>
            {options.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {options.map((opt, optIndex) => (
                  <Badge
                    key={opt}
                    variant="secondary"
                    className="gap-1 pr-1"
                  >
                    {opt}
                    <button
                      type="button"
                      className="rounded-full hover:bg-muted-foreground/20"
                      onClick={() =>
                        field.onChange(
                          options.filter((_, i) => i !== optIndex),
                        )
                      }
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <FormDescription className="text-xs">
              Escribe una opción y presiona Enter.
            </FormDescription>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

export function CreateCategoryDialog() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<CategoryInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      description: "",
      template: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "template",
  });

  const watchedTemplate = useWatch({ control: form.control, name: "template" });

  function onSubmit(values: z.infer<typeof categorySchema>) {
    startTransition(async () => {
      const result = await createCategoryAction(values);
      if (result.success) {
        toast.success("Categoría creada exitosamente");
        setOpen(false);
        form.reset();
      } else {
        toast.error(result.error || "Error al crear la categoría");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FolderPlus className="mr-2 h-4 w-4" />
          Nueva Categoría
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Categoría</DialogTitle>
          <DialogDescription>
            Define una nueva categoría y sus atributos dinámicos.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Smartphones" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descripción de la categoría..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <div>
                  <h4 className="font-semibold text-sm">Atributos Dinámicos</h4>
                  <p className="text-xs text-muted-foreground">
                    Define qué propiedades tendrán los productos de esta
                    categoría.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    append({ key: "", label: "", type: "text", options: [] })
                  }
                >
                  <Plus className="h-3 w-3 mr-1" /> Agregar Atributo
                </Button>
              </div>

              {fields.length === 0 && (
                <div className="text-center py-4 text-sm text-muted-foreground border-2 border-dashed rounded-md">
                  No hay atributos definidos. Agrega uno para empezar.
                </div>
              )}

              <div className="space-y-4">
                {fields.map((field, index) => {
                  const attrType = watchedTemplate?.[index]?.type;
                  return (
                  <div
                    key={field.id}
                    className="p-4 border rounded-md relative bg-muted/20"
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6 text-destructive hover:text-destructive/80"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <FormField
                        control={form.control}
                        name={`template.${index}.label`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">
                              Etiqueta (Label)
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Ej: Memoria RAM"
                                className="h-8 text-sm"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`template.${index}.key`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">
                              Clave (Key)
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Ej: ram_memory"
                                className="h-8 text-sm font-mono"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name={`template.${index}.type`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">
                              Tipo de Campo
                            </FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue placeholder="Seleccionar tipo" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="text">
                                  Texto Libre
                                </SelectItem>
                                <SelectItem value="number">Número</SelectItem>
                                <SelectItem value="select">
                                  Lista de Opciones
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {attrType === "select" && (
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <SelectOptionsEditor
                          control={form.control}
                          index={index}
                        />
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Guardando..." : "Crear Categoría"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
