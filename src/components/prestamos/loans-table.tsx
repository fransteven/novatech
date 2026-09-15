"use client";

import { useState, useMemo } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
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
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { LoanStatusBadge } from "./loan-status-badge";
import { LoanDetailSheet } from "./loan-detail-sheet";
import { LoanPaymentSheet } from "./loan-payment-sheet";
import {
  Eye,
  DollarSign,
  Search,
  X,
  Landmark,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react";

export interface LoanItem {
  id: string;
  status: string;
  subStatus: string;
  principalAmount: number;
  outstandingPrincipal: number;
  interestRate: number;
  termMonths: number;
  installmentAmount: number;
  originationFee: number;
  disbursedAt: Date;
  expiresAt: Date;
  createdAt: Date;
  collateral: string | null;
  notes: string | null;
  riskScore: number;
  riskLevel: string;
  writeOffAmount: number | null;
  writtenOffAt: Date | null;
  customerId: string;
  customerName: string;
  customerDocument: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  totalPaid: number;
  overdueInstallmentsCount: number;
  paidInstallmentsCount: number;
  totalInstallmentsCount: number;
}

interface CashAccount {
  id: string;
  name: string;
  balance?: number;
}

interface LoansTableProps {
  data: LoanItem[];
  accounts: CashAccount[];
  onRefresh?: () => void;
}

type FilterChip = "all" | "al_dia" | "en_mora" | "rojo" | "completed" | "defaulted";

export function LoansTable({ data, accounts, onRefresh }: LoansTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeChip, setActiveChip] = useState<FilterChip>("all");

  // Estado de modales
  const [detailOpen, setDetailOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [selectedCuotaNumber, setSelectedCuotaNumber] = useState<number | undefined>(undefined);

  // Filtrado local
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      // Filtro por texto
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesText =
          item.customerName.toLowerCase().includes(q) ||
          (item.customerDocument && item.customerDocument.toLowerCase().includes(q)) ||
          (item.customerPhone && item.customerPhone.includes(q)) ||
          (item.collateral && item.collateral.toLowerCase().includes(q)) ||
          item.id.toLowerCase().includes(q);
        if (!matchesText) return false;
      }

      // Filtro por chip
      if (activeChip === "al_dia") {
        return item.status === "active" && item.subStatus === "al_dia";
      }
      if (activeChip === "en_mora") {
        return item.status === "active" && item.subStatus === "en_mora";
      }
      if (activeChip === "rojo") {
        return item.riskLevel === "rojo";
      }
      if (activeChip === "completed") {
        return item.status === "completed";
      }
      if (activeChip === "defaulted") {
        return item.status === "defaulted";
      }

      return true;
    });
  }, [data, searchQuery, activeChip]);

  const selectedLoan = useMemo(() => {
    return data.find((l) => l.id === selectedLoanId) ?? null;
  }, [data, selectedLoanId]);

  const columns: ColumnDef<LoanItem>[] = useMemo(
    () => [
      {
        accessorKey: "customerName",
        header: "Cliente",
        meta: { mobileLabel: "Cliente" },
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div>
              <div className="font-semibold text-foreground text-sm leading-tight">
                {item.customerName}
              </div>
              <div className="text-xs text-muted-foreground flex flex-wrap gap-1.5 mt-0.5">
                {item.customerDocument && <span>C.C. {item.customerDocument}</span>}
                {item.customerPhone && <span>· Tel: {item.customerPhone}</span>}
              </div>
              {item.collateral && (
                <div className="text-[11px] text-muted-foreground/80 italic mt-0.5 truncate max-w-[200px]">
                  Garantía: {item.collateral}
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Estado",
        meta: { mobileLabel: "Estado" },
        cell: ({ row }) => {
          const item = row.original;
          return (
            <LoanStatusBadge
              status={item.status}
              subStatus={item.subStatus}
              riskLevel={item.riskLevel}
              showRisk
            />
          );
        },
      },
      {
        accessorKey: "principalAmount",
        header: "Monto Prestado",
        meta: { mobileLabel: "Prestado" },
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {formatCurrency(row.original.principalAmount)}
          </span>
        ),
      },
      {
        accessorKey: "interestRate",
        header: "Tasa Mensual",
        meta: { mobileLabel: "Tasa" },
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold text-foreground">
            {(row.original.interestRate * 100).toFixed(1)}%
          </span>
        ),
      },
      {
        accessorKey: "outstandingPrincipal",
        header: "Saldo Insoluto",
        meta: { mobileLabel: "Saldo" },
        cell: ({ row }) => (
          <span className="font-mono text-sm font-bold text-primary">
            {formatCurrency(row.original.outstandingPrincipal)}
          </span>
        ),
      },
      {
        accessorKey: "installmentAmount",
        header: "Cuota Fija",
        meta: { mobileLabel: "Cuota" },
        cell: ({ row }) => (
          <div className="text-xs">
            <span className="font-mono font-medium">
              {formatCurrency(row.original.installmentAmount)}
            </span>
            <div className="text-[11px] text-muted-foreground">
              {row.original.paidInstallmentsCount} de {row.original.totalInstallmentsCount} pagadas
            </div>
            {row.original.overdueInstallmentsCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-3 w-3" />
                {row.original.overdueInstallmentsCount} vencida
                {row.original.overdueInstallmentsCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
        ),
      },
      {
        id: "actions",
        header: () => <span className="text-right block">Acciones</span>,
        meta: { mobileLabel: "Acciones" },
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex items-center justify-end gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-2.5 text-xs gap-1.5"
                title="Ver detalle completo"
                onClick={() => {
                  setSelectedLoanId(item.id);
                  setDetailOpen(true);
                }}
              >
                <Eye className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Detalle</span>
              </Button>

              {item.status === "active" && (
                <Button
                  size="sm"
                  className="h-9 px-3 text-xs gap-1.5 font-semibold"
                  title="Registrar cobro"
                  onClick={() => {
                    setSelectedLoanId(item.id);
                    setSelectedCuotaNumber(undefined);
                    setPaymentOpen(true);
                  }}
                >
                  <DollarSign className="h-3.5 w-3.5" />
                  <span>Cobrar</span>
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 15,
      },
    },
  });

  return (
    <div className="space-y-4">
      {/* Barra de búsqueda y filtros */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            data-search-shortcut
            data-search-id="loans-search"
            data-search-label="Buscar préstamos"
            placeholder="Buscar por cliente, documento, teléfono o garantía..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8 h-11 text-sm bg-card"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Chips de filtro rápido */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveChip("all")}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-medium border whitespace-nowrap transition-colors ${
              activeChip === "all"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card hover:bg-muted text-muted-foreground border-border"
            }`}
          >
            Todos ({data.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveChip("al_dia")}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-medium border whitespace-nowrap transition-colors ${
              activeChip === "al_dia"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card hover:bg-muted text-muted-foreground border-border"
            }`}
          >
            Al día
          </button>
          <button
            type="button"
            onClick={() => setActiveChip("en_mora")}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-medium border whitespace-nowrap transition-colors ${
              activeChip === "en_mora"
                ? "bg-amber-600 text-white border-amber-600 font-bold"
                : "bg-card hover:bg-muted text-muted-foreground border-border"
            }`}
          >
            En mora ({data.filter((l) => l.subStatus === "en_mora" && l.status === "active").length})
          </button>
          <button
            type="button"
            onClick={() => setActiveChip("rojo")}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-medium border whitespace-nowrap transition-colors ${
              activeChip === "rojo"
                ? "bg-red-600 text-white border-red-600 font-bold"
                : "bg-card hover:bg-muted text-muted-foreground border-border"
            }`}
          >
            Riesgo Alto
          </button>
          <button
            type="button"
            onClick={() => setActiveChip("completed")}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-medium border whitespace-nowrap transition-colors ${
              activeChip === "completed"
                ? "tf-badge-normal border-[color:var(--tf-green)]"
                : "bg-card hover:bg-muted text-muted-foreground border-border"
            }`}
          >
            Completados
          </button>
          <button
            type="button"
            onClick={() => setActiveChip("defaulted")}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-medium border whitespace-nowrap transition-colors ${
              activeChip === "defaulted"
                ? "tf-badge-out border-[color:var(--tf-red)]"
                : "bg-card hover:bg-muted text-muted-foreground border-border"
            }`}
          >
            Castigados
          </button>
        </div>
      </div>

      {/* Tabla con soporte de tarjetas móviles */}
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
                    icon={Landmark}
                    headline={
                      searchQuery || activeChip !== "all"
                        ? "No se encontraron préstamos con ese filtro"
                        : "No hay préstamos de dinero registrados"
                    }
                    description={
                      searchQuery || activeChip !== "all"
                        ? "Intenta modificando los términos de búsqueda o filtros"
                        : "Haz clic en 'Nuevo Préstamo' para desembolsar el primero"
                    }
                    className="border-0 py-12"
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginación */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between gap-2 pt-2">
          <div className="text-xs text-muted-foreground">
            Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()} (
            {filteredData.length} préstamos)
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 text-xs"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 text-xs"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Siguiente
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Sheet de Detalle */}
      <LoanDetailSheet
        loanId={selectedLoanId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        accounts={accounts}
        onOpenPayment={(loanId, cuotaNum) => {
          setSelectedLoanId(loanId);
          setSelectedCuotaNumber(cuotaNum);
          setPaymentOpen(true);
        }}
        onRefresh={onRefresh}
      />

      {/* Sheet de Pagos */}
      {selectedLoan && (
        <LoanPaymentSheet
          loanId={selectedLoan.id}
          outstandingPrincipal={selectedLoan.outstandingPrincipal}
          installmentAmount={selectedLoan.installmentAmount}
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          accounts={accounts}
          initialScheduleNumber={selectedCuotaNumber}
          onSuccess={onRefresh}
        />
      )}
    </div>
  );
}
