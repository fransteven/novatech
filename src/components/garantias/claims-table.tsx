"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateClaimStatusAction } from "@/app/actions/warranty-actions";

const STATUS_OPTIONS = [
  { value: "abierto", label: "Abierto" },
  { value: "en_reparacion", label: "En reparación" },
  { value: "reparado", label: "Reparado" },
  { value: "reemplazado", label: "Reemplazado" },
  { value: "rechazado", label: "Rechazado" },
] as const;

export interface WarrantyClaimRow {
  id: string;
  issue: string;
  status: string;
  withinWarranty: boolean;
  reportedSerial: string | null;
  reportedAt: Date | string;
  productName: string;
  serialNumber: string | null;
  customerName: string | null;
}

export function ClaimsTable({ claims }: { claims: WarrantyClaimRow[] }) {
  const [rows, setRows] = useState(claims);
  const [isPending, startTransition] = useTransition();

  const handleStatusChange = (claimId: string, status: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === claimId ? { ...r, status } : r)),
    );
    startTransition(async () => {
      const res = await updateClaimStatusAction({ claimId, status });
      if (!res.success) {
        toast.error(res.error || "Error al actualizar el estado");
        setRows(claims);
      }
    });
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead>Serial</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Falla</TableHead>
            <TableHead>Cobertura</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length > 0 ? (
            rows.map((claim) => (
              <TableRow key={claim.id}>
                <TableCell className="font-medium">{claim.productName}</TableCell>
                <TableCell className="font-mono text-[12.5px]">
                  {claim.reportedSerial || claim.serialNumber || "-"}
                </TableCell>
                <TableCell>{claim.customerName || "Sin registrar"}</TableCell>
                <TableCell className="max-w-[220px] truncate">{claim.issue}</TableCell>
                <TableCell>
                  <Badge variant={claim.withinWarranty ? "default" : "destructive"}>
                    {claim.withinWarranty ? "Vigente" : "Vencida"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {new Date(claim.reportedAt).toLocaleDateString("es-CO")}
                </TableCell>
                <TableCell>
                  <Select
                    value={claim.status}
                    onValueChange={(value) => handleStatusChange(claim.id, value)}
                    disabled={isPending}
                  >
                    <SelectTrigger className="h-8 w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center">
                No hay reclamos de garantía registrados.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
