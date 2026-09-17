"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PurchaseForm } from "./purchase-form";
import type { PickerProduct } from "./product-picker";

interface PurchaseSheetProps {
  providers: { id: string; name: string }[];
  cashAccounts: { id: string; name: string; balance?: string | number }[];
  products: PickerProduct[];
}

export function PurchaseSheet({
  providers: initialProviders,
  cashAccounts,
  products,
}: PurchaseSheetProps) {
  const router = useRouter();
  const [providers, setProviders] = useState(initialProviders);
  const [open, setOpen] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setProviders(initialProviders);
  }, [initialProviders]);

  const handleProviderCreated = (newProvider: { id: string; name: string }) => {
    setProviders((prev) => {
      if (prev.some((p) => p.id === newProvider.id)) return prev;
      return [...prev, newProvider];
    });
    router.refresh();
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isDirty) {
      setConfirmDiscardOpen(true);
      return;
    }
    setOpen(nextOpen);
  };

  const handleConfirmDiscard = () => {
    setConfirmDiscardOpen(false);
    setIsDirty(false);
    setOpen(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetTrigger asChild>
          <Button className="h-[38px] px-[14px] text-[13.5px] font-semibold">
            <Plus className="h-4 w-4 mr-2" />
            Nueva compra
          </Button>
        </SheetTrigger>
        <SheetContent
          className="flex flex-col overflow-hidden w-full sm:w-[92vw] md:w-[88vw] lg:w-[58rem] xl:w-[66rem] sm:max-w-5xl xl:max-w-6xl p-0 bg-card border-l border-border gap-0"
          style={{ boxShadow: "var(--tf-shadow-lg)" }}
        >
          <SheetHeader className="px-4 sm:px-6 pt-4 sm:pt-[22px] pb-3.5 sm:pb-[18px] border-b border-border shrink-0">
            <SheetTitle className="text-[18px] font-bold tracking-[-0.02em]">
              Registrar compra
            </SheetTitle>
            <SheetDescription className="text-[13px] text-[color:var(--tf-fg-muted)]">
              Entra la mercancía al inventario, prorratea los costos adicionales
              y registra el pago al proveedor en una sola operación.
            </SheetDescription>
          </SheetHeader>

          <PurchaseForm
            providers={providers}
            cashAccounts={cashAccounts}
            products={products}
            onProviderCreated={handleProviderCreated}
            onSuccess={() => {
              setIsDirty(false);
              setOpen(false);
            }}
            onCancel={() => handleOpenChange(false)}
            onDirtyChange={setIsDirty}
            className="flex-1 min-h-0"
          />
        </SheetContent>
      </Sheet>

      {/* Guardia de cierre accidental */}
      <AlertDialog
        open={confirmDiscardOpen}
        onOpenChange={setConfirmDiscardOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar esta compra?</AlertDialogTitle>
            <AlertDialogDescription>
              Tienes datos ingresados en el formulario. Si sales ahora, se
              perderán todos los productos, montos y números de serie digitados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleConfirmDiscard}
            >
              Descartar compra
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
