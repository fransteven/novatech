"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PlusCircle } from "lucide-react";
import { createDistributionAction } from "@/app/actions/shareholder-actions";
import { createDistributionSchema } from "@/lib/validators/shareholder-validator";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
import { Textarea } from "@/components/ui/textarea";

const fmt = (amount: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(amount);

interface DistributionDialogProps {
  defaultNetProfit?: number;
}

export function DistributionDialog({ defaultNetProfit }: DistributionDialogProps) {
  const [open, setOpen] = useState(false);

  const form = useForm({
    resolver: zodResolver(createDistributionSchema),
    defaultValues: {
      periodYear: new Date().getFullYear() - 1,
      totalNetProfit: defaultNetProfit ?? 0,
      notes: "",
    },
  });

  const watchedProfit = form.watch("totalNetProfit") ?? 0;
  const perShareholder = Number(watchedProfit) / 2;

  async function onSubmit(values: { periodYear: number; totalNetProfit: number; notes?: string }) {
    const result = await createDistributionAction(values);
    if (result.success) {
      toast.success("Reparto registrado", {
        description: `Distribución para ${values.periodYear} creada correctamente.`,
      });
      setOpen(false);
      form.reset();
    } else {
      toast.error("Error al registrar reparto", { description: result.error });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-[38px] px-[14px] text-[13.5px] font-semibold bg-primary hover:bg-primary/90 text-primary-foreground">
          <PlusCircle className="mr-2 h-4 w-4" />
          Nuevo reparto
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Reparto Anual</DialogTitle>
          <DialogDescription>
            Declara la utilidad neta del período y calcula el reparto 50/50
            entre los accionistas.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="periodYear"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Año del período *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="2025"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="totalNetProfit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Utilidad neta total (COP) *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="1"
                      placeholder="0"
                      value={field.value as number}
                      onBlur={field.onBlur}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Preview split */}
            {perShareholder > 0 && (
              <div className="rounded-[10px] border border-border bg-muted/30 p-4 space-y-2">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Vista previa del reparto
                </p>
                <div className="flex justify-between text-[13px]">
                  <span>Juan Diego Torres (50%)</span>
                  <span className="font-semibold text-green-600">{fmt(perShareholder)}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span>Frankly Estiven Chindicue Muñoz (50%)</span>
                  <span className="font-semibold text-green-600">{fmt(perShareholder)}</span>
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Observaciones sobre el cierre del período..."
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-primary text-primary-foreground font-semibold">
                Confirmar reparto
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
