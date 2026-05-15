"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { PurchaseForm } from "./PurchaseForm";

export function PurchaseDialog({
  providers,
  cashAccounts,
  products,
}: {
  providers: { id: string; name: string }[];
  cashAccounts: { id: string; name: string; balance?: string | number }[];
  products: { id: string; name: string; attributes?: unknown; isSerialized?: boolean }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-9 px-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nueva Compra
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Compra</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          <PurchaseForm
            providers={providers}
            cashAccounts={cashAccounts}
            products={products}
            onSuccess={() => setOpen(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
