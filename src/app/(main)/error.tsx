"use client";

import { CircleAlert } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";

interface MainErrorProps {
  reset: () => void;
}

export default function MainError({ reset }: MainErrorProps) {
  return (
    <PageShell className="space-y-6">
      <PageHeader
        eyebrow="REGISTRO OPERATIVO"
        title="Módulo no disponible"
        description="No fue posible preparar esta vista. Intenta cargarla de nuevo."
      />
      <EmptyState
        icon={CircleAlert}
        headline="No se pudo cargar la información"
        description="La operación no se modificó. Si el problema persiste, vuelve a intentarlo más tarde."
        action={{ label: "Reintentar", onClick: reset }}
      />
    </PageShell>
  );
}
