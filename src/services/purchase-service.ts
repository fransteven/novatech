import { db } from "@/db";
import {
  purchases,
  purchaseDetails,
  productItems,
  inventoryMovements,
  cashMovements,
  products,
  providers,
} from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";

export interface PurchaseDetailInput {
  productId: string;
  isSerialized: boolean;
  quantity: number;
  unitCost: number;
  // If serialized:
  serialNumbers?: string[];
  conditionDetails?: Record<string, unknown>;
  notes?: string;
}

export interface CreatePurchaseInput {
  providerId: string;
  accountId: string;
  paymentMethod: string;
  referenceCode?: string;
  notes?: string;
  invoiceNumber?: string;
  subtotalAmount: number;
  totalAmount: number;
  userId: string;
  details: PurchaseDetailInput[];
}

export const PurchaseService = {
  async createPurchase(input: CreatePurchaseInput) {
    return await db.transaction(async (tx) => {
      // 1. Insert header
      const [purchase] = await tx
        .insert(purchases)
        .values({
          providerId: input.providerId,
          accountId: input.accountId,
          paymentMethod: input.paymentMethod,
          referenceCode: input.referenceCode,
          notes: input.notes,
          invoiceNumber: input.invoiceNumber,
          subtotalAmount: input.subtotalAmount.toString(),
          totalAmount: input.totalAmount.toString(),
          userId: input.userId,
        })
        .returning();

      // 2. Insert details, create productItems if serialized, create inventory movements
      for (const detail of input.details) {
        if (detail.isSerialized) {
          if (!detail.serialNumbers || detail.serialNumbers.length !== detail.quantity) {
            throw new Error(`Cantidad de seriales no coincide con la cantidad del producto.`);
          }

          for (let i = 0; i < detail.quantity; i++) {
            const serial = detail.serialNumbers[i];

            // Create product_item
            const [item] = await tx
              .insert(productItems)
              .values({
                productId: detail.productId,
                serialNumber: serial,
                status: "available",
                ownerType: "masterplay",
                baseCost: detail.unitCost.toString(),
                conditionDetails: detail.conditionDetails,
                notes: detail.notes,
              })
              .returning();

            // Insert purchase detail
            await tx.insert(purchaseDetails).values({
              purchaseId: purchase.id,
              productId: detail.productId,
              productItemId: item.id,
              quantity: 1,
              unitCost: detail.unitCost.toString(),
              lineTotal: detail.unitCost.toString(),
              serialNumber: serial,
              conditionDetails: detail.conditionDetails,
              notes: detail.notes,
            });

            // Insert inventory movement
            await tx.insert(inventoryMovements).values({
              productId: detail.productId,
              productItemId: item.id,
              type: "IN",
              quantity: 1,
              unitCost: detail.unitCost.toString(),
              reason: `Compra #${purchase.id.slice(0, 8)}`,
            });
          }
        } else {
          // Not serialized
          await tx.insert(purchaseDetails).values({
            purchaseId: purchase.id,
            productId: detail.productId,
            quantity: detail.quantity,
            unitCost: detail.unitCost.toString(),
            lineTotal: (detail.quantity * detail.unitCost).toString(),
            notes: detail.notes,
          });

          await tx.insert(inventoryMovements).values({
            productId: detail.productId,
            type: "IN",
            quantity: detail.quantity,
            unitCost: detail.unitCost.toString(),
            reason: `Compra #${purchase.id.slice(0, 8)}`,
          });
        }
      }

      // 3. Create cash movement (egreso)
      await tx.insert(cashMovements).values({
        accountId: input.accountId,
        direction: "out",
        amount: input.totalAmount.toString(),
        sourceType: "purchase_payment",
        sourceId: purchase.id,
        paymentMethod: input.paymentMethod,
        referenceCode: input.referenceCode,
        createdBy: input.userId,
      });

      return purchase;
    });
  },

  async getPurchases() {
    const data = await db
      .select({
        purchase: purchases,
        provider: providers,
      })
      .from(purchases)
      .leftJoin(providers, eq(purchases.providerId, providers.id))
      .orderBy(desc(purchases.purchaseDate));

    return data.map((d) => ({
      ...d.purchase,
      provider: d.provider,
    }));
  },

  async getPurchaseById(id: string) {
    const [purchaseData] = await db
      .select({
        purchase: purchases,
        provider: providers,
      })
      .from(purchases)
      .leftJoin(providers, eq(purchases.providerId, providers.id))
      .where(eq(purchases.id, id));

    if (!purchaseData) return null;

    const details = await db
      .select({
        detail: purchaseDetails,
        product: products,
      })
      .from(purchaseDetails)
      .leftJoin(products, eq(purchaseDetails.productId, products.id))
      .where(eq(purchaseDetails.purchaseId, id));

    return {
      ...purchaseData.purchase,
      provider: purchaseData.provider,
      details: details.map((d) => ({
        ...d.detail,
        product: d.product,
      })),
    };
  },

  async getPurchaseStats() {
    const result = await db
      .select({
        totalAmount: sql<number>`SUM(${purchases.totalAmount}::numeric)`,
        count: sql<number>`COUNT(${purchases.id})`,
      })
      .from(purchases);

    return {
      totalAmount: result[0]?.totalAmount || 0,
      count: result[0]?.count || 0,
    };
  },
};
