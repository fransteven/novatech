"use client";

import { useState } from "react";
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
import { PurchaseForm } from "./purchase-form";
import type { PickerProduct } from "./product-picker";

interface PurchaseSheetProps {
  providers: { id: string; name: string }[];
  cashAccounts: { id: string; name: string; balance?: string | number }[];
  products: PickerProduct[];
}

export function PurchaseSheet({
  providers,
  cashAccounts,
  products,
}: PurchaseSheetProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="h-[38px] px-[14px] text-[13.5px] font-semibold">
          <Plus className="h-4 w-4 mr-2" />
          Nueva compra
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col overflow-y-auto w-full sm:max-w-3xl p-0 bg-card border-l border-border">
        <SheetHeader className="px-6 pt-[22px] pb-[18px] border-b border-border">
          <SheetTitle className="text-[18px] font-bold tracking-[-0.02em]">
            Registrar compra
          </SheetTitle>
          <SheetDescription className="text-[13px] text-[color:var(--tf-fg-muted)]">
            Entra la mercancía al inventario, prorratea los costos adicionales y
            registra el pago al proveedor en una sola operación.
          </SheetDescription>
        </SheetHeader>
        <div className="px-6 py-5">
          <PurchaseForm
            providers={providers}
            cashAccounts={cashAccounts}
            products={products}
            onSuccess={() => setOpen(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
