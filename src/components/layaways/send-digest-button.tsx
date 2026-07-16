"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendDigestNowAction } from "@/app/actions/reminder-actions";

export function SendDigestButton() {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await sendDigestNowAction();
      if (!result.success) {
        toast.error("Error", { description: result.error });
        return;
      }
      if (result.itemCount === 0) {
        toast.info(result.message || "No hay cobros pendientes hoy.");
        return;
      }
      toast.success("Recordatorio enviado", {
        description: `${result.itemCount} cobros incluidos en el correo.`,
      });
    });
  }

  return (
    <Button variant="outline" size="sm" disabled={isPending} onClick={handleClick}>
      <Mail className="h-4 w-4 mr-2" />
      {isPending ? "Enviando..." : "Enviar recordatorio ahora"}
    </Button>
  );
}
