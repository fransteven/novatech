"use client";

import {
  ColumnDef,
  FilterFn,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getFilteredRowModel,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Eye, HandCoins, XCircle, Clock, Search, X } from "lucide-react";
import { useState, useMemo } from "react";
import { LayawayDetailsDialog } from "./layaway-details-dialog";
import { LayawayPaymentDialog } from "./layaway-payment-dialog";
import { CreditPaymentDialog } from "./credit-payment-dialog";
import { cancelLayawayAction } from "@/app/actions/layaway-actions";
import { toast } from "sonner";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";

interface Layaway {
  id: string;
  type: string;
  status: string;
  subStatus: string | null;
  totalAmount: number;
  expiresAt: Date;
  createdAt: Date;
  termMonths: number | null;
  installmentAmount: number | null;
  outstandingPrincipal: number | null;
  riskScore: number | null;
  riskLevel: string | null;
  customerName: string | null;
  customerDocument: string | null;
  customerPhone: string | null;
  totalPaid: number;
  balance: number;
  // "Producto IMEI | Producto IMEI" — armado en getLayaways()
  devices: string;
}

interface CashAccount {
  id: string;
  name: string;
}

interface LayawaysTableProps {
  data: Layaway[];
  accounts: CashAccount[];
}

function getEffectiveStatus(layaway: Layaway): string {
  if (layaway.status === "completed" || layaway.balance <= 0) return "completed";
  if (layaway.status === "cancelled") return "cancelled";
  if (layaway.status === "defaulted") return "defaulted";
  if (layaway.type === "credito" && layaway.subStatus === "en_mora") return "overdue";
  if (layaway.type === "sin_interes" && new Date(layaway.expiresAt) < new Date()) return "overdue";
  return "active";
}

const RISK_BADGE: Record<string, { label: string; className: string }> = {
  verde:    { label: "🟢 Bajo riesgo",     className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  amarillo: { label: "🟡 Riesgo medio",    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  rojo:     { label: "🔴 Alto riesgo",     className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
};

export function LayawaysTable({ data, accounts }: LayawaysTableProps) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [creditPaymentOpen, setCreditPaymentOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [selectedLayaway, setSelectedLayaway] = useState<Layaway | null>(null);
  // Solo aplica a créditos: el equipo ya está con el cliente y hay que saber si
  // volvió antes de devolverlo al inventario.
  const [deviceRecovered, setDeviceRecovered] = useState<boolean | null>(null);

  const isCancellingCredit = selectedLayaway?.type === "credito";

  const handleCancel = async () => {
    if (!selectedLayaway) return;
    if (isCancellingCredit && deviceRecovered === null) return;

    const res = await cancelLayawayAction(
      selectedLayaway.id,
      isCancellingCredit ? { deviceRecovered: deviceRecovered! } : {},
    );

    if (res.success) {
      toast.success(
        res.deviceRecovered
          ? "Cancelado. El equipo volvió al inventario."
          : "Cancelado. El equipo salió del inventario y se registró la venta por lo cobrado.",
      );
      setCancelOpen(false);
      setDeviceRecovered(null);
    } else {
      toast.error(res.error || "Error al cancelar el apartado");
    }
  };

  const columns = useMemo<ColumnDef<Layaway>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "Fecha",
        meta: { mobileLabel: "Fecha" },
        cell: ({ row }) =>
          new Date(row.getValue("createdAt")).toLocaleDateString("es-ES"),
      },
      {
        accessorKey: "customerName",
        header: "Cliente",
        meta: { mobileLabel: "Cliente" },
        cell: ({ row }) => {
          const layaway = row.original;
          return (
            <div>
              <div className="font-medium">{layaway.customerName || "Sin Nombre"}</div>
              <div className="text-xs text-muted-foreground">
                {layaway.customerDocument}
                {layaway.customerPhone ? ` • ${layaway.customerPhone}` : ""}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "devices",
        header: "Equipo",
        meta: { mobileLabel: "Equipo" },
        cell: ({ row }) => {
          const devices = row.original.devices;
          if (!devices) return <span className="text-muted-foreground text-xs">—</span>;
          return (
            <div className="text-xs">
              {devices.split(" | ").map((d) => (
                <div key={d} className="font-mono">{d}</div>
              ))}
            </div>
          );
        },
      },
      {
        id: "type",
        header: "Modalidad",
        meta: { mobileLabel: "Modalidad" },
        cell: ({ row }) => {
          const l = row.original;
          return l.type === "credito" ? (
            <Badge variant="outline" className="text-xs font-medium text-blue-600 border-blue-300 dark:text-blue-400 dark:border-blue-700">
              Crédito {l.termMonths ? `${l.termMonths}m` : ""}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">Sin interés</Badge>
          );
        },
      },
      {
        id: "effectiveStatus",
        header: "Estado",
        meta: { mobileLabel: "Estado" },
        cell: ({ row }) => (
          <StatusBadge status={getEffectiveStatus(row.original)} />
        ),
      },
      {
        id: "riskLevel",
        header: "Riesgo",
        meta: { mobileLabel: "Riesgo" },
        cell: ({ row }) => {
          const l = row.original;
          if (l.type !== "credito" || !l.riskLevel) return <span className="text-muted-foreground text-xs">—</span>;
          const badge = RISK_BADGE[l.riskLevel] ?? RISK_BADGE.verde;
          return (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.className}`}>
              {badge.label}
            </span>
          );
        },
      },
      {
        accessorKey: "totalAmount",
        header: "Total",
        meta: { mobileLabel: "Total" },
        cell: ({ row }) => (
          <div className="text-right font-medium">
            {formatCurrency(row.getValue("totalAmount"))}
          </div>
        ),
      },
      {
        id: "saldoInsoluto",
        header: "Saldo insoluto",
        meta: { mobileLabel: "S. insoluto" },
        cell: ({ row }) => {
          const l = row.original;
          if (l.type !== "credito") return <span className="text-muted-foreground text-xs text-right block">—</span>;
          return (
            <div className="text-right font-bold text-primary">
              {formatCurrency(l.outstandingPrincipal ?? 0)}
            </div>
          );
        },
      },
      {
        accessorKey: "balance",
        header: "Saldo total",
        meta: { mobileLabel: "Saldo" },
        cell: ({ row }) => (
          <div className="text-right text-muted-foreground">
            {formatCurrency(row.getValue("balance"))}
          </div>
        ),
      },
      {
        id: "actions",
        header: "Acciones",
        meta: { mobileLabel: "" },
        cell: ({ row }) => {
          const layaway = row.original;
          const canPay = layaway.status === "active" && layaway.balance > 0;
          return (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2"
                aria-label="Ver detalles"
                onClick={() => {
                  setSelectedLayaway(layaway);
                  setDetailsOpen(true);
                }}
              >
                <Eye className="h-4 w-4 mr-1" /> Detalles
              </Button>
              {canPay && (
                <Button
                  variant="default"
                  size="sm"
                  className="h-8 px-2"
                  aria-label="Registrar pago"
                  onClick={() => {
                    setSelectedLayaway(layaway);
                    if (layaway.type === "credito") {
                      setCreditPaymentOpen(true);
                    } else {
                      setPaymentOpen(true);
                    }
                  }}
                >
                  <HandCoins className="h-4 w-4 mr-1" />
                  {layaway.type === "credito" ? "Pagar" : "Abonar"}
                </Button>
              )}
              {layaway.status === "active" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  aria-label="Cancelar"
                  onClick={() => {
                    setSelectedLayaway(layaway);
                    setCancelOpen(true);
                  }}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    []
  );

  // El filtro por defecto de TanStack solo mira columnas con accessorKey, así
  // que documento, teléfono e IMEI quedaban fuera. Los IMEI se dictan por
  // bloques, por eso se quitan espacios y guiones a ambos lados.
  const globalFilterFn = useMemo<FilterFn<Layaway>>(
    () => (row, _columnId, filterValue) => {
      const raw = String(filterValue).trim().toLowerCase();
      if (!raw) return true;

      const l = row.original;
      const haystack = [
        l.customerName,
        l.customerDocument,
        l.customerPhone,
        l.devices,
        new Date(l.createdAt).toLocaleDateString("es-ES"),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (haystack.includes(raw)) return true;

      const strip = (v: string) => v.replace(/[\s-]/g, "");
      return strip(haystack).includes(strip(raw));
    },
    []
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
  });

  const filteredCount = table.getFilteredRowModel().rows.length;
  const totalCount = data.length;

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar por cliente, documento, IMEI o serial..."
              value={globalFilter ?? ""}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-9 pr-9"
            />
            {globalFilter && (
              <button
                onClick={() => setGlobalFilter("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpiar filtro"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {globalFilter
              ? `${filteredCount} de ${totalCount} resultados`
              : `${totalCount} registros`}
          </span>
        </div>

        <div className="w-full md:overflow-x-auto">
          <Table mobileCards>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        data-label={cell.column.columnDef.meta?.mobileLabel ?? ""}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="p-0">
                    <EmptyState
                      icon={Clock}
                      headline={
                        globalFilter
                          ? "No se encontraron registros con ese filtro"
                          : "No hay apartados ni créditos registrados"
                      }
                      description={
                        globalFilter
                          ? "Intenta con un término diferente"
                          : "Los apartados y créditos aparecerán aquí cuando se creen"
                      }
                      className="border-0"
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Siguiente
          </Button>
        </div>
      </div>

      {/* Diálogos */}
      <LayawayDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        layawayId={selectedLayaway?.id || null}
        customerName={selectedLayaway?.customerName || null}
        layawayType={selectedLayaway?.type ?? "sin_interes"}
      />

      <LayawayPaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        layawayId={selectedLayaway?.id || null}
        balance={selectedLayaway?.balance || 0}
        onSuccess={() => setPaymentOpen(false)}
        accounts={accounts}
      />

      {selectedLayaway?.type === "credito" && (
        <CreditPaymentDialog
          open={creditPaymentOpen}
          onOpenChange={setCreditPaymentOpen}
          layawayId={selectedLayaway?.id || null}
          outstandingPrincipal={selectedLayaway?.outstandingPrincipal ?? 0}
          installmentAmount={selectedLayaway?.installmentAmount ?? 0}
          onSuccess={() => setCreditPaymentOpen(false)}
          accounts={accounts}
        />
      )}

      <AlertDialog
        open={cancelOpen}
        onOpenChange={(open) => {
          setCancelOpen(open);
          if (!open) setDeviceRecovered(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Está seguro de cancelar este apartado/crédito?</AlertDialogTitle>
            <AlertDialogDescription>
              {isCancellingCredit
                ? "Esta acción es irreversible. En un crédito el equipo ya se entregó, así que necesitamos saber dónde quedó antes de tocar el inventario."
                : "Esta acción es irreversible. Los productos reservados volverán a estar disponibles en el inventario."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {isCancellingCredit && (
            <div className="space-y-2 rounded-md border border-border p-3 text-sm">
              <p className="font-medium">¿Se recuperó el equipo?</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={deviceRecovered === true ? "default" : "outline"}
                  onClick={() => setDeviceRecovered(true)}
                >
                  Sí, volvió a la tienda
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={deviceRecovered === false ? "default" : "outline"}
                  onClick={() => setDeviceRecovered(false)}
                >
                  No, se quedó con el cliente
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {deviceRecovered === true &&
                  "El equipo vuelve al inventario y lo cobrado se registra como ingreso por retención."}
                {deviceRecovered === false &&
                  "El equipo sale del inventario y se registra como venta por el monto cobrado, con su costo real (la utilidad puede quedar negativa)."}
                {deviceRecovered === null && "Elige una opción para continuar."}
              </p>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={isCancellingCredit && deviceRecovered === null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar Cancelación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
