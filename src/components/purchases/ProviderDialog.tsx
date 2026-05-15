"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createProviderSchema, CreateProviderSchema } from "@/lib/validators/provider-validator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { createProviderAction } from "@/app/actions/provider-actions";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export function ProviderDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<CreateProviderSchema>({
    resolver: zodResolver(createProviderSchema) as any,
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
      if (res.success) {
        toast.success("Proveedor creado correctamente");
        setOpen(false);
        form.reset();
      } else {
        toast.error(res.error || "Error al crear proveedor");
      }
    } catch (error) {
      toast.error("Ocurrió un error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" type="button">
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo Proveedor</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Nombre *</Label>
            <Input {...form.register("name")} placeholder="Nombre del proveedor o empresa" />
            {form.formState.errors.name && <p className="text-red-500 text-xs">{form.formState.errors.name.message}</p>}
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
            <Textarea {...form.register("notes")} placeholder="Notas adicionales..." />
          </div>

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Guardar Proveedor"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
