"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createCountAction } from "@/app/actions/stock-count-actions";

export const NewCountButton = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  const create = () =>
    startTransition(async () => {
      const result = await createCountAction({ name });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      router.push(`/inventory/count/${result.data.id}`);
    });

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} className="h-[38px]">
        <Plus className="mr-2 h-4 w-4" />
        Nuevo conteo
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo conteo</DialogTitle>
            <DialogDescription>
              Un conteo por zona es más fácil de terminar y revisar.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              create();
            }}
          >
            <Label htmlFor="count-name">Zona o estante</Label>
            <Input
              id="count-name"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej. Vitrina 1 – juegos PS5"
            />
          </form>
          <DialogFooter>
            <Button type="button" onClick={create} disabled={pending || name.trim().length < 2}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Empezar a escanear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
