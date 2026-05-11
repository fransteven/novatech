"use client";

import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, UserPlus, X } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import {
  searchCustomersAction,
  createCustomerAction,
} from "@/app/actions/customer-actions";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export interface Customer {
  id: string;
  documentId: string | null;
  name: string;
  phone: string | null;
  email: string | null;
}

interface CustomerSelectorProps {
  onSelect: (customer: Customer | null) => void;
  selectedCustomer: Customer | null;
}

export function CustomerSelector({
  onSelect,
  selectedCustomer,
}: CustomerSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  // Dialog para crear cliente nuevo
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    documentId: "",
    name: "",
    phone: "",
    email: "",
  });

  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => {
    async function fetchCustomers() {
      if (debouncedSearch.length < 2) {
        setCustomers([]);
        return;
      }
      setLoading(true);
      const res = await searchCustomersAction(debouncedSearch);
      if (res.success && res.data) {
        setCustomers(res.data);
      }
      setLoading(false);
    }

    fetchCustomers();
  }, [debouncedSearch]);

  const handleCreateCustomer = async () => {
    if (!newCustomer.documentId || !newCustomer.name) {
      toast.error("Documento y Nombre son obligatorios");
      return;
    }

    const res = await createCustomerAction(newCustomer);
    if (res.success && res.data) {
      toast.success("Cliente registrado exitosamente");
      onSelect(res.data);
      setCreateDialogOpen(false);
      setOpen(false);
      // Limpiar form
      setNewCustomer({ documentId: "", name: "", phone: "", email: "" });
    } else {
      toast.error(res.error || "Error al crear cliente");
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center justify-between">
        <Label className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-[0.06em]">
          Cliente asociado
        </Label>
        {selectedCustomer && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-2 text-[10.5px] text-muted-foreground hover:text-foreground"
            onClick={() => onSelect(null)}
          >
            <X className="h-3 w-3 mr-1" />
            Remover
          </Button>
        )}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal h-auto py-2 px-3 border-input"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {selectedCustomer ? (
                <>
                  <span
                    className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[11.5px] font-semibold text-white"
                    style={{ background: "linear-gradient(135deg, oklch(0.7 0.14 200), oklch(0.65 0.18 305))" }}
                  >
                    {selectedCustomer.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                  </span>
                  <div className="flex flex-col items-start min-w-0">
                    <span className="text-[13px] font-semibold text-foreground truncate">{selectedCustomer.name}</span>
                    {selectedCustomer.documentId && (
                      <span className="text-[11px] text-muted-foreground truncate">{selectedCustomer.documentId}</span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <span className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center bg-muted text-muted-foreground border border-border">
                    <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
                  </span>
                  <div className="flex flex-col items-start">
                    <span className="text-[13px] font-semibold text-foreground">Consumidor Final</span>
                    <span className="text-[11px] text-muted-foreground">Venta anónima</span>
                  </div>
                </>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[350px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Buscar por cédula o nombre..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              {loading && <div className="p-4 text-center text-sm text-muted-foreground">Buscando...</div>}
              {!loading && customers.length === 0 && searchQuery.length >= 2 && (
                <CommandEmpty className="py-6 text-center">
                  <p className="text-sm text-muted-foreground mb-4">
                    No se encontró a &quot;{searchQuery}&quot;
                  </p>
                  <Button
                    size="sm"
                    onClick={() => {
                      setNewCustomer((prev) => ({ ...prev, name: searchQuery }));
                      setCreateDialogOpen(true);
                      setOpen(false);
                    }}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Registrar Cliente Nuevo
                  </Button>
                </CommandEmpty>
              )}
              <CommandGroup>
                {customers.map((customer) => (
                  <CommandItem
                    key={customer.id}
                    value={customer.id}
                    onSelect={() => {
                      onSelect(customer);
                      setOpen(false);
                    }}
                    className="gap-2.5"
                  >
                    <span
                      className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-semibold text-white"
                      style={{ background: "linear-gradient(135deg, oklch(0.7 0.14 200), oklch(0.65 0.18 305))" }}
                    >
                      {customer.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                    </span>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[12.5px] font-semibold truncate">{customer.name}</span>
                      <span className="text-[11px] text-muted-foreground truncate">
                        {customer.documentId} {customer.phone ? `• ${customer.phone}` : ""}
                      </span>
                    </div>
                    <Check
                      className={cn(
                        "h-4 w-4 flex-shrink-0 text-primary",
                        selectedCustomer?.id === customer.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            
            {/* Action fija al final del popover */}
            <div className="p-2 border-t border-border bg-muted/30">
              <Button
                variant="ghost"
                className="w-full justify-start text-[13px] h-8 text-primary hover:text-primary hover:bg-accent/60 gap-2"
                onClick={() => {
                  setCreateDialogOpen(true);
                  setOpen(false);
                }}
              >
                <span className="w-5 h-5 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                  <UserPlus className="h-3 w-3 text-accent-foreground" />
                </span>
                Registrar Cliente Nuevo
              </Button>
            </div>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Dialogo para crear cliente */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Registrar Nuevo Cliente</DialogTitle>
            <DialogDescription>
              Añade los datos del cliente para asociarlos a sus compras o apartados.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="doc" className="text-right text-xs">
                Cédula/NIT *
              </Label>
              <Input
                id="doc"
                value={newCustomer.documentId}
                onChange={(e) => setNewCustomer({ ...newCustomer, documentId: e.target.value })}
                className="col-span-3"
                placeholder="Ej: 10203040"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right text-xs">
                Nombre *
              </Label>
              <Input
                id="name"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                className="col-span-3"
                placeholder="Ej: Juan Pérez"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phone" className="text-right text-xs">
                Teléfono
              </Label>
              <Input
                id="phone"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                className="col-span-3"
                placeholder="Ej: 300 123 4567"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateCustomer}>Guardar y Seleccionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
