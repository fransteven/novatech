"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createPurchaseSchema, CreatePurchaseSchema } from "@/lib/validators/purchase-validator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createPurchaseAction } from "@/app/actions/purchase-actions";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { ProviderDialog } from "./ProviderDialog";

export function PurchaseForm({
  providers,
  cashAccounts,
  products,
  onSuccess,
}: {
  providers: { id: string; name: string }[];
  cashAccounts: { id: string; name: string; balance?: string | number }[];
  products: { id: string; name: string; attributes?: unknown; isSerialized?: boolean }[];
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const form = useForm<CreatePurchaseSchema>({
    resolver: zodResolver(createPurchaseSchema) as any,
    defaultValues: {
      providerId: "",
      accountId: "",
      paymentMethod: "transfer",
      referenceCode: "",
      notes: "",
      invoiceNumber: "",
      subtotalAmount: 0,
      totalAmount: 0,
      details: [{ productId: "", isSerialized: false, quantity: 1, unitCost: 0, serialNumbers: [] }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "details",
  });

  const watchDetails = form.watch("details");

  const calculateTotals = () => {
    const details = form.getValues("details");
    const subtotal = details.reduce((acc, curr) => acc + (Number(curr.quantity) * Number(curr.unitCost)), 0);
    form.setValue("subtotalAmount", subtotal);
    form.setValue("totalAmount", subtotal);
  };

  const onSubmit = async (data: CreatePurchaseSchema) => {
    setLoading(true);
    try {
      const res = await createPurchaseAction(data);
      if (res.success) {
        toast.success("Compra registrada correctamente");
        onSuccess();
      } else {
        toast.error(res.error || "Error al registrar compra");
      }
    } catch (error) {
      toast.error("Ocurrió un error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Proveedor</Label>
          <div className="flex items-center gap-2">
            <Select
              value={form.watch("providerId")}
              onValueChange={(val) => form.setValue("providerId", val)}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Seleccionar proveedor" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ProviderDialog />
          </div>
          {form.formState.errors.providerId && <p className="text-red-500 text-xs">{form.formState.errors.providerId.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>Factura / Comprobante</Label>
          <Input {...form.register("invoiceNumber")} placeholder="Ej. FAC-001" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Cuenta de Pago (Caja)</Label>
          <Select
            value={form.watch("accountId")}
            onValueChange={(val) => form.setValue("accountId", val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar cuenta" />
            </SelectTrigger>
            <SelectContent>
              {cashAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name} (${Number(a.balance).toLocaleString()})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.accountId && <p className="text-red-500 text-xs">{form.formState.errors.accountId.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>Método de Pago</Label>
          <Select
            value={form.watch("paymentMethod")}
            onValueChange={(val) => form.setValue("paymentMethod", val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar método" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="transfer">Transferencia</SelectItem>
              <SelectItem value="cash">Efectivo</SelectItem>
              <SelectItem value="card">Tarjeta</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Productos</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ productId: "", isSerialized: false, quantity: 1, unitCost: 0, serialNumbers: [] })}
          >
            <Plus className="h-4 w-4 mr-2" /> Agregar Línea
          </Button>
        </div>

        {fields.map((field, index) => {
          const detail = watchDetails[index];
          const isSerialized = detail?.isSerialized || false;

          return (
            <div key={field.id} className="p-4 border border-border rounded-lg bg-muted/20 space-y-4">
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 md:col-span-5 space-y-2">
                  <Label>Producto</Label>
                  <Select
                    value={detail.productId}
                    onValueChange={(val) => {
                      const prod = products.find(p => p.id === val);
                      form.setValue(`details.${index}.productId`, val);
                      form.setValue(`details.${index}.isSerialized`, prod?.isSerialized || false);
                      if (prod?.isSerialized) {
                        form.setValue(`details.${index}.quantity`, 1);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar producto" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name} {p.attributes ? JSON.stringify(p.attributes) : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.details?.[index]?.productId && (
                    <p className="text-red-500 text-xs">{form.formState.errors.details[index]?.productId?.message}</p>
                  )}
                </div>

                <div className="col-span-4 md:col-span-2 space-y-2">
                  <Label>Cantidad</Label>
                  <Input
                    type="number"
                    min="1"
                    {...form.register(`details.${index}.quantity` as const, {
                      onChange: () => calculateTotals()
                    })}
                    disabled={isSerialized}
                  />
                </div>

                <div className="col-span-6 md:col-span-3 space-y-2">
                  <Label>Costo Unitario</Label>
                  <Input
                    type="number"
                    step="0.01"
                    {...form.register(`details.${index}.unitCost` as const, {
                      onChange: () => calculateTotals()
                    })}
                  />
                </div>

                <div className="col-span-2 md:col-span-2 flex items-end justify-end pb-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-red-500 hover:text-red-600 hover:bg-red-100/50"
                    onClick={() => {
                      remove(index);
                      calculateTotals();
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {isSerialized && (
                <div className="space-y-2">
                  <Label>Serial / IMEI (Ingresa y presiona coma o enter para separar si son varios)</Label>
                  <Input
                    placeholder="Ej. IMEI123456"
                    onChange={(e) => {
                      const vals = e.target.value.split(',').map(v => v.trim()).filter(v => v);
                      form.setValue(`details.${index}.serialNumbers`, vals);
                      form.setValue(`details.${index}.quantity`, vals.length || 1);
                      calculateTotals();
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Seriales identificados: {detail.serialNumbers?.length || 0}
                  </p>
                  {form.formState.errors.details?.[index]?.serialNumbers && (
                    <p className="text-red-500 text-xs">{form.formState.errors.details[index]?.serialNumbers?.message}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {form.formState.errors.details?.message && (
          <p className="text-red-500 text-sm">{form.formState.errors.details.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Notas</Label>
        <Textarea {...form.register("notes")} placeholder="Observaciones de la compra..." />
      </div>

      <div className="flex flex-col items-end gap-2 p-4 bg-muted/30 rounded-lg border border-border">
        <div className="flex justify-between w-full md:w-1/3">
          <span className="font-semibold text-muted-foreground">Subtotal:</span>
          <span className="font-mono">{form.watch("subtotalAmount").toLocaleString("es-CO", { style: "currency", currency: "COP" })}</span>
        </div>
        <div className="flex justify-between w-full md:w-1/3">
          <span className="font-bold text-lg">Total:</span>
          <span className="font-mono font-bold text-lg text-[color:var(--tf-green)]">
            {form.watch("totalAmount").toLocaleString("es-CO", { style: "currency", currency: "COP" })}
          </span>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-border">
        <Button type="submit" disabled={loading} className="w-full md:w-auto min-w-[150px]">
          {loading ? "Procesando..." : "Registrar Compra"}
        </Button>
      </div>
    </form>
  );
}
