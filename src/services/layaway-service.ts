import { db } from "@/db";
import {
  layaways,
  layawayDetails,
  cashTransactions,
  cashMovements,
  productItems,
  inventoryMovements,
  customers,
  products,
  sales,
  saleDetails,
} from "@/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { CreateLayawayInput, AddLayawayPaymentInput } from "@/lib/validators/layaway-validator";

export const getLayaways = async () => {
  // Obtenemos los apartados, el cliente y sumamos los abonos usando un subquery/aggregation
  const result = await db
    .select({
      id: layaways.id,
      status: layaways.status,
      totalAmount: layaways.totalAmount,
      expiresAt: layaways.expiresAt,
      createdAt: layaways.createdAt,
      customerName: customers.name,
      customerDocument: customers.documentId,
      customerPhone: customers.phone,
      totalPaid: sql<number>`COALESCE(SUM(CAST(${cashTransactions.amount} AS DECIMAL)), 0)`.mapWith(Number),
    })
    .from(layaways)
    .leftJoin(customers, eq(layaways.customerId, customers.id))
    .leftJoin(
      cashTransactions,
      sql`${cashTransactions.referenceId} = ${layaways.id} AND ${cashTransactions.type} = 'layaway_deposit'`
    )
    .groupBy(layaways.id, customers.name, customers.documentId, customers.phone)
    .orderBy(desc(layaways.createdAt));

  return result.map(l => ({
    ...l,
    totalAmount: Number(l.totalAmount),
    balance: Number(l.totalAmount) - l.totalPaid
  }));
};

export const createLayaway = async (data: CreateLayawayInput) => {
  return await db.transaction(async (tx) => {
    // 1. Crear el documento de apartado (Cabecera)
    const [newLayaway] = await tx
      .insert(layaways)
      .values({
        customerId: data.customerId,
        totalAmount: data.totalAmount.toString(),
        expiresAt: data.expiresAt,
        status: "active",
      })
      .returning();

    // 2. Procesar cada ítem del carrito
    for (const item of data.items) {
      // Insertar detalle
      await tx.insert(layawayDetails).values({
        layawayId: newLayaway.id,
        productId: item.productId,
        productItemId: item.productItemId || null,
        quantity: item.quantity,
        agreedPrice: item.price.toString(),
      });

      // 3. Actualizar Inventario
      if (item.isSerialized && item.productItemId) {
        // Bloquear el ítem serializado
        await tx
          .update(productItems)
          .set({ status: "reserved" })
          .where(eq(productItems.id, item.productItemId));
      } else if (!item.isSerialized) {
        // Restar del inventario genérico (Tipo especial para apartados)
        await tx.insert(inventoryMovements).values({
          productId: item.productId,
          productItemId: null,
          type: "RESERVED_OUT",
          quantity: item.quantity,
          reason: `Apartado #${newLayaway.id.slice(0, 8)}`,
        });
      }
    }

    // 4. Registrar el abono inicial en la caja si existe
    if (data.initialDeposit > 0) {
      await tx.insert(cashTransactions).values({
        type: "layaway_deposit",
        amount: data.initialDeposit.toString(),
        method: data.paymentMethod,
        referenceId: newLayaway.id,
        notes: "Abono inicial",
      });

      if (data.accountId) {
        await tx.insert(cashMovements).values({
          accountId: data.accountId,
          direction: "in",
          sourceType: "layaway_deposit",
          sourceId: newLayaway.id,
          paymentMethod: data.paymentMethod,
          amount: data.initialDeposit.toString(),
          referenceCode: data.referenceCode ?? null,
          notes: "Abono inicial",
          createdBy: null,
          status: "posted",
        });
      }
    }

    return newLayaway;
  });
};

export const getLayawayDetails = async (layawayId: string) => {
  const details = await db
    .select({
      id: layawayDetails.id,
      productId: products.id,
      productName: products.name,
      isSerialized: products.isSerialized,
      sku: products.sku,
      quantity: layawayDetails.quantity,
      agreedPrice: layawayDetails.agreedPrice,
      serialNumber: productItems.serialNumber,
    })
    .from(layawayDetails)
    .innerJoin(products, eq(layawayDetails.productId, products.id))
    .leftJoin(productItems, eq(layawayDetails.productItemId, productItems.id))
    .where(eq(layawayDetails.layawayId, layawayId));

  const payments = await db
    .select({
      id: cashTransactions.id,
      amount: cashTransactions.amount,
      method: cashTransactions.method,
      createdAt: cashTransactions.createdAt,
      notes: cashTransactions.notes,
    })
    .from(cashTransactions)
    .where(
      and(
        eq(cashTransactions.referenceId, layawayId),
        eq(cashTransactions.type, "layaway_deposit")
      )
    )
    .orderBy(desc(cashTransactions.createdAt));

  return { items: details, payments };
};

export const addLayawayPayment = async (data: AddLayawayPaymentInput) => {
  return await db.transaction(async (tx) => {
    // 1. Verificar estado actual
    const [layaway] = await tx
      .select()
      .from(layaways)
      .where(eq(layaways.id, data.layawayId))
      .limit(1);

    if (!layaway) throw new Error("Apartado no encontrado");
    if (layaway.status !== "active") throw new Error(`El apartado no está activo (Estado actual: ${layaway.status})`);

    const paidQuery = await tx
      .select({ total: sql<number>`COALESCE(SUM(CAST(${cashTransactions.amount} AS DECIMAL)), 0)`.mapWith(Number) })
      .from(cashTransactions)
      .where(and(eq(cashTransactions.referenceId, layaway.id), eq(cashTransactions.type, "layaway_deposit")));
    
    const totalPaid = paidQuery[0]?.total || 0;
    const totalAmount = Number(layaway.totalAmount);
    const balance = totalAmount - totalPaid;

    if (data.amount > balance) throw new Error("El abono supera el saldo pendiente");

    // 2. Registrar el pago
    await tx.insert(cashTransactions).values({
      type: "layaway_deposit",
      amount: data.amount.toString(),
      method: data.paymentMethod,
      referenceId: layaway.id,
      notes: data.notes || "Abono a apartado",
    });

    if (data.accountId) {
      await tx.insert(cashMovements).values({
        accountId: data.accountId,
        direction: "in",
        sourceType: "layaway_deposit",
        sourceId: layaway.id,
        paymentMethod: data.paymentMethod,
        amount: data.amount.toString(),
        referenceCode: data.referenceCode ?? null,
        notes: data.notes ?? "Abono a apartado",
        createdBy: null,
        status: "posted",
      });
    }

    // 3. ¿Se completó el pago?
    if (totalPaid + data.amount >= totalAmount) {
      // 3a. Marcar layaway como completado
      await tx.update(layaways).set({ status: "completed" }).where(eq(layaways.id, layaway.id));

      // 3b. Crear la Venta real para contabilidad
      const [sale] = await tx.insert(sales).values({
        customerId: layaway.customerId,
        totalAmount: layaway.totalAmount,
        status: "completed",
      }).returning();

      // Buscar detalles del apartado para pasarlos a la venta
      const details = await tx.select().from(layawayDetails).where(eq(layawayDetails.layawayId, layaway.id));

      for (const item of details) {
        // En un caso real habría que calcular comisiones/costos aquí también, pero simplificaremos:
        await tx.insert(saleDetails).values({
          saleId: sale.id,
          productId: item.productId,
          productItemId: item.productItemId,
          price: item.agreedPrice,
          unitCost: "0", // Idealmente se trae el costo real
        });

        if (item.productItemId) {
          // Serializado: Pasa de reserved a sold
          await tx.update(productItems).set({ status: "sold" }).where(eq(productItems.id, item.productItemId));
          // Y generamos un movimiento OUT
          await tx.insert(inventoryMovements).values({
            productItemId: item.productItemId,
            productId: item.productId,
            type: "OUT",
            quantity: 1,
            unitCost: "0", // Idealmente costo real
            reason: `Venta por Apartado Completado #${layaway.id.slice(0,8)}`,
          });
        } else {
          // Genérico: Convertimos el RESERVED_OUT en OUT (añadiendo un nuevo movimiento para que cuadre)
          await tx.insert(inventoryMovements).values({
            productItemId: null,
            productId: item.productId,
            type: "OUT",
            quantity: item.quantity,
            reason: `Venta por Apartado Completado #${layaway.id.slice(0,8)}`,
          });
        }
      }
    }

    return { success: true };
  });
};

export const cancelLayaway = async (layawayId: string) => {
  return await db.transaction(async (tx) => {
    const [layaway] = await tx.select().from(layaways).where(eq(layaways.id, layawayId)).limit(1);
    if (!layaway || layaway.status !== "active") throw new Error("No se puede cancelar este apartado");

    // 1. Cambiar estado
    await tx.update(layaways).set({ status: "cancelled" }).where(eq(layaways.id, layawayId));

    // 2. Liberar inventario
    const details = await tx.select().from(layawayDetails).where(eq(layawayDetails.layawayId, layawayId));
    
    for (const item of details) {
      if (item.productItemId) {
        await tx.update(productItems).set({ status: "available" }).where(eq(productItems.id, item.productItemId));
      } else {
        // Reingresar el inventario reservado
        await tx.insert(inventoryMovements).values({
          productId: item.productId,
          type: "RESERVED_IN",
          quantity: item.quantity,
          reason: `Cancelación Apartado #${layawayId.slice(0,8)}`,
        });
      }
    }

    // Nota: El dinero abonado se podría registrar como gasto si se devuelve, pero asumiremos que lo manejan manual.
    return { success: true };
  });
};
