"use client";

import { ReservationCard } from "@/components/reservations/reservation-card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";

// Mock data: Generate expiry times relative to now
const now = new Date();
const mockReservations = [
  {
    id: "ord_12345678",
    customerName: "Carlos Pérez",
    items: ["iPhone 15 Pro", "Funda Silicona"],
    total: 1249.98,
    expiresAt: new Date(now.getTime() + 1000 * 60 * 30), // 30 mins
    status: "ready" as const,
  },
  {
    id: "ord_87654321",
    customerName: "Ana García",
    items: ["MacBook Air M2"],
    total: 999.0,
    expiresAt: new Date(now.getTime() + 1000 * 60 * 120), // 2 hours
    status: "pending" as const,
  },
  {
    id: "ord_11223344",
    customerName: "Luis Rodríguez",
    items: ["Samsung S24 Ultra", "Cargador 45W"],
    total: 1349.98,
    expiresAt: new Date(now.getTime() + 1000 * 60 * 5), // 5 mins
    status: "ready" as const,
  },
  {
    id: "ord_55667788",
    customerName: "María López",
    items: ["AirPods Pro 2"],
    total: 249.0,
    expiresAt: new Date(now.getTime() - 1000 * 60 * 10), // Expired 10 mins ago
    status: "ready" as const,
  },
];

export default function ReservationsPage() {
  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="Reservas online"
        description="Vista de demostración para pedidos pendientes de retiro; no representa operaciones activas."
        eyebrow="DEMO"
        actions={<Badge variant="outline" className="bg-muted text-muted-foreground">Datos de muestra</Badge>}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {mockReservations.map((res) => (
          <ReservationCard key={res.id} {...res} />
        ))}
      </div>
    </PageShell>
  );
}
