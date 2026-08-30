"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, PackagePlus } from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
import { CreateProductDialog } from "@/components/catalog/create-product-dialog";
import { cn } from "@/lib/utils";

export interface PickerProduct {
  id: string;
  name: string;
  sku: string | null;
  isSerialized: boolean;
  price: string | number;
  attributes: unknown;
  stock?: number;
}

/** Los atributos dinámicos se muestran como "256GB · Negro", nunca como JSON. */
export const describeAttributes = (attributes: unknown): string => {
  if (!attributes || typeof attributes !== "object") return "";
  return Object.values(attributes as Record<string, unknown>)
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map((value) => String(value))
    .join(" · ");
};

interface ProductPickerProps {
  products: PickerProduct[];
  value?: string;
  onSelect: (product: PickerProduct) => void;
  /** Se dispara cuando el usuario crea un producto que no existía en el catálogo. */
  onProductCreated: (product: PickerProduct) => void;
  disabled?: boolean;
}

/**
 * Selector de producto con búsqueda sobre el catálogo real (nombre, SKU y
 * atributos). Si lo buscado no existe, deja crearlo sin abandonar la compra.
 */
export function ProductPicker({
  products,
  value,
  onSelect,
  onProductCreated,
  disabled,
}: ProductPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const selected = products.find((product) => product.id === value);

  const openCreateDialog = () => {
    setOpen(false);
    setCreateOpen(true);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal h-auto py-2 px-3 text-left"
          >
            {selected ? (
              <span className="flex flex-col items-start min-w-0">
                <span className="text-[13px] font-semibold truncate">
                  {selected.name}
                </span>
                {describeAttributes(selected.attributes) && (
                  <span className="text-xs text-muted-foreground truncate">
                    {describeAttributes(selected.attributes)}
                  </span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground">
                Buscar producto del catálogo...
              </span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
        >
          <Command>
            <CommandInput
              placeholder="Nombre, SKU o atributo..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>
                <div className="px-3 py-4 text-center space-y-3">
                  <p className="text-[13px] text-muted-foreground">
                    Ese producto no está en el catálogo.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={openCreateDialog}
                  >
                    <PackagePlus className="h-4 w-4 mr-2" />
                    Crear {search ? `"${search}"` : "producto"}
                  </Button>
                </div>
              </CommandEmpty>
              <CommandGroup>
                {products.map((product) => {
                  const attrs = describeAttributes(product.attributes);
                  const searchValue = [product.name, product.sku, attrs]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <CommandItem
                      key={product.id}
                      value={searchValue}
                      onSelect={() => {
                        onSelect(product);
                        setOpen(false);
                      }}
                    >
                      <span className="flex flex-col min-w-0 flex-1">
                        <span className="text-[12.5px] truncate">
                          {product.name}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {[
                            attrs,
                            product.sku,
                            product.stock !== undefined
                              ? `Stock: ${product.stock}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      {product.isSerialized && (
                        <Badge variant="outline" className="ml-2 shrink-0">
                          Serial
                        </Badge>
                      )}
                      <Check
                        className={cn(
                          "ml-2 h-4 w-4 shrink-0",
                          value === product.id ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              <CommandGroup>
                <CommandItem value="__crear-producto__" onSelect={openCreateDialog}>
                  <PackagePlus className="h-4 w-4 mr-2" />
                  <span className="text-[12.5px]">Crear producto nuevo</span>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <CreateProductDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        trigger={null}
        defaultName={search}
        onCreated={(product) => {
          const created: PickerProduct = {
            id: product.id,
            name: product.name,
            sku: product.sku,
            isSerialized: product.isSerialized,
            price: product.price,
            attributes: product.attributes,
            stock: 0,
          };
          onProductCreated(created);
          onSelect(created);
          setSearch("");
        }}
      />
    </>
  );
}
