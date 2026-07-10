"use client";

import { useState } from "react";
import { PosProductList } from "@/components/pos/pos-product-list";
import { CustomerSelector, Customer } from "@/components/pos/customer-selector";
import { LayawayDialog } from "@/components/pos/layaway-dialog";
import { CreditDialog } from "@/components/pos/credit-dialog";
import { toast } from "sonner";
import { Trash2, CreditCard, ShoppingCart, MonitorCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { processSaleAction } from "@/app/actions/pos-action";
import { formatCurrency } from "@/lib/formatters";

interface CartItem {
  productId: string;
  productItemId: string | null;
  name: string;
  price: number;
  isSerialized: boolean;
  quantity: number;
  unitCost: number;
  availableQty?: number;
}

export default function PosPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  const handleAddToCart = (item: CartItem) => {
    setCartItems((prev) => {
      if (item.isSerialized) {
        if (prev.some((p) => p.productItemId === item.productItemId)) {
          toast.warning("Este serial ya está en el carrito");
          return prev;
        }
        return [...prev, item];
      }

      const existing = prev.find(
        (p) => p.productId === item.productId && p.price === item.price,
      );

      if (existing) {
        const newQuantity = existing.quantity + 1;
        if (item.availableQty !== undefined && newQuantity > item.availableQty) {
          toast.error(
            `Stock insuficiente. Disponible: ${item.availableQty}, en carrito: ${existing.quantity}`,
          );
          return prev;
        }
        return prev.map((p) =>
          p.productId === item.productId && p.price === item.price
            ? { ...p, quantity: newQuantity }
            : p,
        );
      }

      if (item.availableQty !== undefined && item.availableQty < 1) {
        toast.error(`${item.name} no tiene stock disponible`);
        return prev;
      }

      return [...prev, item];
    });
  };

  const handleRemoveItem = (index: number) => {
    setCartItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;

    setProcessing(true);
    const totalAmount = cartItems.reduce(
      (acc, item) => acc + item.price * item.quantity,
      0,
    );

    try {
      const response = await processSaleAction({
        items: cartItems.map((item) => ({
          productId: item.productId,
          productItemId: item.productItemId,
          price: item.price,
          quantity: item.quantity,
          isSerialized: item.isSerialized,
        })),
        totalAmount,
        userId: selectedCustomer?.id,
      });

      if (response.success) {
        toast.success("Venta completada", {
          description: `Transacción #${response.saleId} registrada exitosamente.`,
        });
        setCartItems([]);
        setSelectedCustomer(null);
        setMobileCartOpen(false);
      } else {
        toast.error("Error al procesar venta", {
          description: response.error,
        });
      }
    } catch {
      toast.error("Error crítico en el checkout");
    } finally {
      setProcessing(false);
    }
  };

  const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const itemCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  const total = subtotal;

  // Shared cart content — rendered in both desktop panel and mobile Sheet
  const CartContent = () => (
    <>
      {/* Cart header */}
      <div
        className="p-4 border-b border-border space-y-3"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in oklch, var(--tf-accent-soft) 35%, var(--tf-bg-elev)), var(--tf-bg-elev))",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[15px] font-bold tracking-[-0.01em] text-foreground">
            <ShoppingCart className="h-[17px] w-[17px]" />
            Carrito
            <Badge className="text-[11px] font-semibold py-0.5 px-2 rounded-full bg-primary text-primary-foreground border-0">
              {itemCount}
            </Badge>
          </div>
          {cartItems.length > 0 && (
            <button
              aria-label="Vaciar carrito"
              className="w-7 h-7 rounded-[7px] flex items-center justify-center text-muted-foreground hover:bg-card hover:text-foreground transition-all duration-100"
              onClick={() => setCartItems([])}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <CustomerSelector
          selectedCustomer={selectedCustomer}
          onSelect={setSelectedCustomer}
        />
      </div>

      {/* Cart body */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Column headings */}
        <div className="px-4 py-2.5 border-b border-border grid grid-cols-[1fr_84px_70px_24px] gap-2 text-[10.5px] uppercase font-semibold tracking-[0.06em] text-muted-foreground">
          <div>Producto</div>
          <div className="text-center">Cant.</div>
          <div className="text-right">Subtotal</div>
          <div />
        </div>

        <ScrollArea className="flex-1">
          {cartItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
              <div className="tf-empty-ring w-16 h-16 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground mb-4">
                <ShoppingCart className="h-6 w-6 opacity-40" />
              </div>
              <p className="text-[14px] font-semibold text-foreground m-0">El carrito está vacío</p>
              <p className="text-[12.5px] text-muted-foreground mt-1">
                Escanea un código o busca un producto
              </p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {cartItems.map((item, index) => (
                <div
                  key={`${item.productItemId || item.productId}-${index}`}
                  className="grid grid-cols-[1fr_84px_70px_24px] gap-2 px-4 py-3 items-center hover:bg-muted/50 transition-colors duration-100 rounded-[9px]"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-foreground truncate">
                      {item.name}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {formatCurrency(item.price)}
                      </span>
                      <span className="text-muted-foreground/50">·</span>
                      <Badge
                        className={`text-[8px] py-0 px-1.5 leading-none uppercase border-0 font-semibold ${item.isSerialized
                          ? "bg-accent text-accent-foreground"
                          : "bg-muted text-muted-foreground"
                          }`}
                      >
                        {item.isSerialized ? "Serial" : "Stock"}
                      </Badge>
                    </div>
                  </div>

                  {/* Quantity stepper */}
                  <div className="flex items-center justify-center">
                    {item.isSerialized ? (
                      <span className="text-center font-semibold text-[13px] text-foreground w-full text-center">
                        {item.quantity}
                      </span>
                    ) : (
                      <div className="inline-flex items-center bg-card border border-input rounded-[7px] overflow-hidden h-7">
                        <button
                          aria-label="Menos"
                          className="w-6 h-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          onClick={() =>
                            setCartItems((prev) =>
                              prev.map((p, i) =>
                                i === index && p.quantity > 1
                                  ? { ...p, quantity: p.quantity - 1 }
                                  : p,
                              ),
                            )
                          }
                        >
                          <span className="text-sm leading-none">−</span>
                        </button>
                        <span className="w-8 text-center font-mono text-[12.5px] font-semibold text-foreground">
                          {item.quantity}
                        </span>
                        <button
                          aria-label="Más"
                          className="w-6 h-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          onClick={() =>
                            setCartItems((prev) =>
                              prev.map((p, i) => {
                                if (i !== index) return p;
                                const newQty = p.quantity + 1;
                                if (p.availableQty !== undefined && newQty > p.availableQty) {
                                  toast.error(`Stock máximo: ${p.availableQty}`);
                                  return p;
                                }
                                return { ...p, quantity: newQty };
                              }),
                            )
                          }
                        >
                          <span className="text-sm leading-none">+</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="text-[13px] font-bold text-foreground font-mono">
                      {formatCurrency(item.price * item.quantity)}
                    </div>
                    {item.quantity > 1 && (
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {formatCurrency(item.price)} c/u
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <button
                      aria-label={`Eliminar ${item.name}`}
                      className="w-[22px] h-[22px] rounded-[5px] flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      onClick={() => handleRemoveItem(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Totals */}
      <div className="border-t border-border bg-muted/50 px-[18px] py-3.5 space-y-1">
        <div className="flex justify-between items-center text-[13px] text-muted-foreground">
          <span>Subtotal ({itemCount} ítem{itemCount !== 1 ? "s" : ""})</span>
          <span className="text-foreground font-medium font-mono">{formatCurrency(subtotal)}</span>
        </div>
      </div>

      {/* Grand total */}
      <div className="flex justify-between items-baseline px-[18px] py-3.5 bg-muted/50 border-t border-border">
        <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-bold">
          Total a cobrar
        </span>
        <span className="text-[32px] font-extrabold tracking-[-0.03em] text-foreground leading-none tabular-nums">
          <span className="text-[18px] text-muted-foreground font-semibold align-super mr-0.5">$</span>
          {total.toFixed(2)}
        </span>
      </div>

      {/* Footer actions */}
      <div className="p-3.5 bg-card border-t border-border space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <LayawayDialog
            cartItems={cartItems}
            totalAmount={total}
            selectedCustomer={selectedCustomer}
            onSuccess={() => {
              setCartItems([]);
              setSelectedCustomer(null);
              setMobileCartOpen(false);
            }}
          />

          <CreditDialog
            cartItems={cartItems}
            totalAmount={total}
            selectedCustomer={selectedCustomer}
            onSuccess={() => {
              setCartItems([]);
              setSelectedCustomer(null);
              setMobileCartOpen(false);
            }}
          />
        </div>

        <Button
          className="w-full h-[46px] font-bold text-[14.5px] gap-2 cursor-pointer text-primary-foreground border-0"
          disabled={cartItems.length === 0 || processing}
          onClick={handleCheckout}
          style={{
            background:
              "linear-gradient(180deg, var(--tf-accent), oklch(0.52 0.2 270))",
            boxShadow:
              "0 1px 0 inset oklch(1 0 0 / 0.25), 0 8px 20px var(--tf-accent-ring)",
          }}
        >
          {processing ? (
            "Procesando..."
          ) : (
            <>
              <CreditCard className="h-4 w-4" />
              Cobrar
              {cartItems.length > 0 && (
                <span className="font-extrabold font-mono tracking-[-0.01em]">
                  {formatCurrency(total)}
                </span>
              )}
            </>
          )}
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* ── Desktop layout: 2-column side-by-side ── */}
      <div className="hidden lg:flex h-[calc(100vh-(--spacing(16))-1px)] gap-5 -m-4 p-4">
        {/* Left Column: products */}
        <div
          className="flex-[3] min-w-0 rounded-[14px] p-6 flex flex-col"
          style={{ boxShadow: "var(--tf-shadow-sm)" }}
        >
          <div className="flex items-end justify-between gap-4 mb-5">
            <div>
              <h1 className="flex items-center gap-3 text-[22px] font-bold tracking-[-0.025em] text-foreground m-0">
                <span
                  className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center text-white flex-shrink-0"
                  style={{
                    background: "linear-gradient(135deg, var(--tf-accent), oklch(0.5 0.2 295))",
                    boxShadow: "0 6px 18px var(--tf-accent-ring)",
                  }}
                >
                  <MonitorCheck className="h-5 w-5" />
                </span>
                Terminal de Ventas
              </h1>
              <p className="text-[13px] text-muted-foreground mt-0.5 ml-[50px]">
                Sesión activa · Modo barcode
              </p>
            </div>
            <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
              <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-card border border-border font-medium">
                <span className="tf-live-dot" />
                En línea
              </span>
            </div>
          </div>
          <PosProductList onAddToCart={handleAddToCart} />
        </div>

        {/* Right Column: Cart */}
        <div
          className="flex-[2] min-w-[380px] max-w-[500px] flex flex-col bg-card border border-border rounded-[14px] overflow-hidden"
          style={{ boxShadow: "var(--tf-shadow-md)" }}
        >
          <CartContent />
        </div>
      </div>

      {/* ── Mobile layout: full-width product list + floating cart button ── */}
      <div className="lg:hidden flex flex-col min-h-[calc(100vh-(--spacing(16))-1px)] pb-24">
        {/* Mobile page header */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <h1 className="flex items-center gap-2.5 text-[18px] font-bold tracking-[-0.025em] text-foreground">
            <span
              className="w-8 h-8 rounded-[8px] flex items-center justify-center text-white flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, var(--tf-accent), oklch(0.5 0.2 295))",
                boxShadow: "0 4px 12px var(--tf-accent-ring)",
              }}
            >
              <MonitorCheck className="h-4 w-4" />
            </span>
            Terminal de Ventas
          </h1>
          <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-card border border-border text-[12px] text-muted-foreground font-medium shrink-0">
            <span className="tf-live-dot" />
            En línea
          </span>
        </div>

        <PosProductList onAddToCart={handleAddToCart} />
      </div>

      {/* Mobile floating cart button */}
      <button
        className="lg:hidden fixed bottom-5 right-4 z-40 flex items-center gap-2 h-14 px-5 rounded-full font-bold text-[14px] text-primary-foreground shadow-xl transition-transform active:scale-95"
        style={{
          background: "linear-gradient(135deg, var(--tf-accent), oklch(0.52 0.2 270))",
          boxShadow: "0 8px 24px var(--tf-accent-ring)",
        }}
        onClick={() => setMobileCartOpen(true)}
        aria-label="Ver carrito"
      >
        <ShoppingCart className="h-5 w-5" />
        {itemCount > 0 ? (
          <>
            Carrito · <span className="font-mono">{formatCurrency(total)}</span>
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white text-[color:var(--tf-accent)] text-[11px] font-extrabold grid place-items-center">
              {itemCount}
            </span>
          </>
        ) : (
          "Carrito vacío"
        )}
      </button>

      {/* Mobile cart Sheet */}
      <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
        <SheetContent side="bottom" className="h-[90dvh] p-0 flex flex-col rounded-t-2xl overflow-hidden">
          {/* Sheet drag handle */}
          <div className="flex items-center justify-between px-4 pt-3 pb-0 shrink-0">
            <SheetTitle className="sr-only">Carrito de compras</SheetTitle>
            <div className="mx-auto w-10 h-1 rounded-full bg-border" />
            <button
              onClick={() => setMobileCartOpen(false)}
              className="absolute right-4 top-3 h-8 w-8 rounded-full grid place-items-center text-muted-foreground hover:bg-muted"
              aria-label="Cerrar carrito"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <CartContent />
        </SheetContent>
      </Sheet>
    </>
  );
}
