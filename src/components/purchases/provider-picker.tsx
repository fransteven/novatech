"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Plus, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ProviderDialog, type CreatedProvider } from "./provider-dialog";
import { cn } from "@/lib/utils";

export interface PickerProvider {
  id: string;
  name: string;
}

interface ProviderPickerProps {
  providers: PickerProvider[];
  value?: string;
  onSelect: (provider: PickerProvider) => void;
  onProviderCreated: (provider: PickerProvider) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Selector de proveedor con búsqueda en vivo.
 * Si el proveedor no existe o se desea crear uno nuevo, permite abrir
 * el diálogo de creación sin perder el estado de la compra.
 */
export function ProviderPicker({
  providers,
  value,
  onSelect,
  onProviderCreated,
  disabled,
  className,
}: ProviderPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const selected = providers.find((p) => p.id === value);

  const openCreateDialog = () => {
    setOpen(false);
    setCreateOpen(true);
  };

  const handleCreated = (newProvider: CreatedProvider) => {
    onProviderCreated(newProvider);
    onSelect(newProvider);
    setCreateOpen(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="provider-picker"
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between font-normal h-9 px-3 text-[13px] min-w-0 text-left border-input bg-card",
              !selected && "text-muted-foreground",
              className,
            )}
          >
            <span className="truncate flex-1 min-w-0">
              {selected ? selected.name : "Seleccionar proveedor..."}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0 z-50"
          align="start"
        >
          <Command>
            <CommandInput
              placeholder="Buscar proveedor..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-60 overflow-y-auto">
              <CommandEmpty>
                <div className="px-3 py-4 text-center space-y-2">
                  <p className="text-xs text-muted-foreground">
                    No se encontró a &quot;{search}&quot;.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs font-medium w-full"
                    onClick={openCreateDialog}
                  >
                    <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                    Crear proveedor {search ? `"${search}"` : ""}
                  </Button>
                </div>
              </CommandEmpty>

              <CommandGroup>
                {providers.map((provider) => {
                  const isSelected = provider.id === value;
                  return (
                    <CommandItem
                      key={provider.id}
                      value={provider.name}
                      onSelect={() => {
                        onSelect(provider);
                        setOpen(false);
                      }}
                      className="text-xs cursor-pointer flex items-center justify-between py-2"
                    >
                      <span className="truncate flex-1 font-medium text-foreground">
                        {provider.name}
                      </span>
                      {isSelected && (
                        <Check className="h-4 w-4 text-[color:var(--tf-accent)] shrink-0 ml-2" />
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>

              <CommandSeparator />
              <div className="p-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs h-8 text-[color:var(--tf-accent)] hover:text-[color:var(--tf-accent)] hover:bg-[color:var(--tf-accent-soft)]"
                  onClick={openCreateDialog}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Registrar nuevo proveedor
                </Button>
              </div>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <ProviderDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialName={search}
        onCreated={handleCreated}
      />
    </>
  );
}
