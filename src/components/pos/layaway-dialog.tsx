"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/formatters";
import { Clock, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { createLayawayAction } from "@/app/actions/layaway-actions";
import { Customer } from "./customer-selector";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

interface CartItem {
  productId: string;
  productItemId: string | null;
  name: string;
  price: number;
  isSerialized: boolean;
  quantity: number;
}

interface LayawayDialogProps {
  cartItems: CartItem[];
  totalAmount: number;
  selectedCustomer: Customer | null;
  onSuccess: () => void;
}

export function LayawayDialog({
  cartItems,
  totalAmount,
  selectedCustomer,
  onSuccess,
}: LayawayDialogProps) {
  const [open, setOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [deposit, setDeposit] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer" | "card">("cash");

  // Por defecto, apartado a 30 días
  const defaultDate = new Date();
  defaultDate.setDate(defaultDate.getDate() + 30);
  const [expiresAt, setExpiresAt] = useState<string>(
    defaultDate.toISOString().split("T")[0]
  );

  const pendingBalance = totalAmount - deposit;

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && !selectedCustomer) {
      toast.error("Cliente Requerido", {
        description: "Debe seleccionar o registrar un cliente antes de poder hacer un apartado.",
      });
      return;
    }
    setOpen(newOpen);
  };

  const handleCreateLayaway = async () => {
    if (!selectedCustomer) return;
    if (deposit < 0) {
      toast.error("El abono no puede ser negativo");
      return;
    }
    if (deposit > totalAmount) {
      toast.error("El abono no puede ser mayor al total de la compra");
      return;
    }

    setProcessing(true);

    try {
      const response = await createLayawayAction({
        customerId: selectedCustomer.id,
        items: cartItems,
        totalAmount,
        initialDeposit: deposit,
        paymentMethod,
        expiresAt: new Date(expiresAt),
      });

      if (response.success) {
        toast.success("Apartado creado exitosamente");
        setOpen(false);
        setDeposit(0);
        onSuccess(); // Limpia el carrito desde PosPage
      } else {
        toast.error("Error al crear apartado", { description: response.error });
      }
    } catch (error) {
      toast.error("Error crítico al procesar el apartado");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="w-full h-[46px] font-bold text-[13px] border-input bg-card hover:bg-muted hover:border-primary hover:text-primary text-foreground cursor-pointer gap-2 transition-all duration-150"
          disabled={cartItems.length === 0}
        >
          <Clock className="h-4 w-4" />
          Apartar
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Crear Apartado</DialogTitle>
          <DialogDescription>
            {selectedCustomer && (
              <span className="block mt-1">
                Cliente: <strong className="text-foreground">{selectedCustomer.name}</strong>
              </span>
            )}
            Se reservará el inventario hasta la fecha de vencimiento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor Total:</span>
              <span className="font-semibold">{formatCurrency(totalAmount)}</span>
            </div>

            <div className="flex items-center gap-4">
              <Label htmlFor="deposit" className="text-xs w-24">Abono Inicial</Label>
              <div className="relative flex-1">
                <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="deposit"
                  type="number"
                  min="0"
                  max={totalAmount}
                  value={deposit || ""}
                  onChange={(e) => setDeposit(Number(e.target.value))}
                  className="pl-8"
                  placeholder="0.00"
                />
              </div>
            </div>

            <Separator />

            <div className="flex justify-between items-center text-lg font-bold text-destructive">
              <span>Saldo Pendiente:</span>
              <span>{formatCurrency(pendingBalance)}</span>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-xs">Vencimiento</Label>
              <div className="col-span-3 relative">
                <Input
                  type="date"
                  value={expiresAt}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            </div>

            {deposit > 0 && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right text-xs">Método (Abono)</Label>
                <div className="col-span-3">
                  <Select value={paymentMethod} onValueChange={(v: "cash" | "transfer" | "card") => setPaymentMethod(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Efectivo</SelectItem>
                      <SelectItem value="transfer">Transferencia</SelectItem>
                      <SelectItem value="card">Tarjeta / Datáfono</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={processing}>
            Cancelar
          </Button>
          <Button onClick={handleCreateLayaway} disabled={processing} className="cursor-pointer" style={{ background: "var(--tf-amber)", color: "white" }}>
            {processing ? "Procesando..." : "Confirmar Apartado"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
