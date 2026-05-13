"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ClipboardCheck } from "lucide-react";
import {
  createCashReconciliationAction,
  getCashAccountBalanceAction,
} from "@/app/actions/cash-actions";
import { CashAccountWithBalance } from "@/services/cash-service";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const schema = z.object({
  accountId: z.string().uuid("Selecciona una cuenta"),
  periodStart: z.string().min(1, "Fecha inicio requerida"),
  periodEnd: z.string().min(1, "Fecha fin requerida"),
  countedBalance: z.coerce.number().refine((v) => !isNaN(v), { message: "Ingresa el saldo contado" }),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface ReconciliationDialogProps {
  accounts: CashAccountWithBalance[];
}

export function ReconciliationDialog({ accounts }: ReconciliationDialogProps) {
  const [open, setOpen] = useState(false);
  const [expectedBalance, setExpectedBalance] = useState<number | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      accountId: "",
      periodStart: "",
      periodEnd: "",
      countedBalance: 0,
      notes: "",
    },
  });

  const accountId = form.watch("accountId");
  const countedBalance = form.watch("countedBalance");

  useEffect(() => {
    if (accountId && accountId !== "") {
      getCashAccountBalanceAction(accountId).then((r) => {
        if (r.success && r.data) setExpectedBalance(r.data.balance);
      });
    }
  }, [accountId]);

  const onSubmit = async (data: FormValues) => {
    const result = await createCashReconciliationAction(data);

    if (result.success) {
      toast.success("Conciliación registrada");
      form.reset();
      setExpectedBalance(null);
      setOpen(false);
    } else {
      toast.error(result.error as string);
    }
  };

  const difference =
    expectedBalance !== null ? Number(countedBalance) - expectedBalance : null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <ClipboardCheck className="h-4 w-4 mr-1.5" />
          Conciliar
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Conciliación de Caja</SheetTitle>
          <SheetDescription>
            Verifica que el saldo físico coincida con el saldo del sistema.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="accountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cuenta</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una cuenta" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="periodStart"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Período inicio</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="periodEnd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Período fin</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="countedBalance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Saldo contado (físico)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {expectedBalance !== null && (
                <div className="rounded-md border p-3 space-y-1 text-sm">
                  <p className="text-muted-foreground">
                    Saldo esperado:{" "}
                    <span className="font-medium text-foreground">
                      {formatCurrency(expectedBalance)}
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    Diferencia:{" "}
                    <span
                      className={
                        difference === 0
                          ? "font-medium text-emerald-600"
                          : "font-medium text-destructive"
                      }
                    >
                      {difference !== null ? formatCurrency(difference) : "—"}
                    </span>
                  </p>
                </div>
              )}

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observaciones (opcional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Observaciones" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full">
                Registrar conciliación
              </Button>
            </form>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
