"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import {
  createProviderSchema,
  CreateProviderSchema,
} from "@/lib/validators/provider-validator";
import { createProviderAction } from "@/app/actions/provider-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export interface CreatedProvider {
  id: string;
  name: string;
}

interface ProviderDialogProps {
  /** Devuelve el proveedor creado para seleccionarlo de inmediato en la compra. */
  onCreated?: (provider: CreatedProvider) => void;
}

export function ProviderDialog({ onCreated }: ProviderDialogProps = {}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<CreateProviderSchema>({
    resolver: zodResolver(createProviderSchema),
    defaultValues: {
      name: "",
      phone: "",
      country: "",
      city: "",
      location: "",
      notes: "",
    },
  });

  const onSubmit = async (data: CreateProviderSchema) => {
    setLoading(true);
    try {
      const res = await createProviderAction(data);
      if (res.success && res.data) {
        toast.success("Proveedor creado correctamente");
        onCreated?.({ id: res.data.id, name: res.data.name });
        setOpen(false);
        form.reset();
      } else {
        toast.error(res.error || "Error al crear proveedor");
      }
    } catch {
      toast.error("Ocurrió un error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" type="button" title="Nuevo proveedor">
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo Proveedor</DialogTitle>
          <DialogDescription>
            Queda disponible de inmediato para esta compra.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Nombre *</Label>
            <Input
              {...form.register("name")}
              placeholder="Nombre del proveedor o empresa"
            />
            {form.formState.errors.name && (
              <p className="text-destructive text-xs">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input {...form.register("phone")} placeholder="Ej. +57 300..." />
            </div>
            <div className="space-y-2">
              <Label>País</Label>
              <Input {...form.register("country")} placeholder="Ej. Colombia" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ciudad</Label>
              <Input {...form.register("city")} placeholder="Ej. Bogotá" />
            </div>
            <div className="space-y-2">
              <Label>Dirección</Label>
              <Input {...form.register("location")} placeholder="Dirección física" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              {...form.register("notes")}
              placeholder="Notas adicionales..."
            />
          </div>

          <div className="flex justify-end pt-4">
            {/* Botón, no submit: este diálogo vive dentro del formulario de compra. */}
            <Button
              type="button"
              disabled={loading}
              onClick={form.handleSubmit(onSubmit)}
            >
              {loading ? "Guardando..." : "Guardar Proveedor"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
