"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";
import type { ScheduleEntry } from "@/lib/credit/amortization";

interface AmortizationPreviewProps {
  schedule: ScheduleEntry[];
  installmentAmount?: number;
}

export function AmortizationPreview({
  schedule,
  installmentAmount,
}: AmortizationPreviewProps) {
  if (!schedule.length) return null;

  const totalInterest = schedule.reduce((s, e) => s + e.interest, 0);
  const totalPrincipal = schedule.reduce((s, e) => s + e.principal, 0);
  const totalPaid = schedule.reduce((s, e) => s + e.totalAmount, 0);

  return (
    <div className="space-y-3">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Cuota fija</p>
          <p className="text-base font-bold text-primary">
            {formatCurrency(installmentAmount ?? schedule[0]?.totalAmount ?? 0)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Total intereses</p>
          <p className="text-base font-bold text-orange-600 dark:text-orange-400">
            {formatCurrency(totalInterest)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Total a pagar</p>
          <p className="text-base font-bold">{formatCurrency(totalPaid)}</p>
        </div>
      </div>

      {/* Schedule table */}
      <div className="rounded-md border overflow-auto max-h-72">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Vencimiento</TableHead>
              <TableHead className="text-right">Capital</TableHead>
              <TableHead className="text-right">Interés</TableHead>
              <TableHead className="text-right">Cuota</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedule.map((entry) => (
              <TableRow key={entry.number} className="text-xs">
                <TableCell className="font-medium">{entry.number}</TableCell>
                <TableCell>
                  {new Date(entry.dueDate).toLocaleDateString("es-CO", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(entry.principal)}
                </TableCell>
                <TableCell className="text-right text-orange-600 dark:text-orange-400">
                  {formatCurrency(entry.interest)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(entry.totalAmount)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatCurrency(entry.remainingBalance)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
