import { relations } from "drizzle-orm";
import { user } from "./auth";
import {
  shareholders,
  shareholderDistributions,
  shareholderDistributionItems,
} from "./shareholders";
import {
  categories,
  products,
  productItems,
  inventoryMovements,
  reservations,
} from "./inventory";
import { sales, saleDetails } from "./sales";
import { expenseCategories, expenses } from "./expenses";
import { customers } from "./customers";
import { layaways, layawayDetails } from "./layaways";
import { importCosts } from "./imports";
import {
  cashAccounts,
  cashMovements,
  cashTransfers,
  cashReconciliations,
} from "./cash";
import { providers, purchases, purchaseDetails } from "./purchases";

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  productItems: many(productItems),
  saleDetails: many(saleDetails),
  inventoryMovements: many(inventoryMovements),
  layawayDetails: many(layawayDetails),
  importCosts: many(importCosts),
  purchaseDetails: many(purchaseDetails),
}));

export const productItemsRelations = relations(
  productItems,
  ({ one, many }) => ({
    product: one(products, {
      fields: [productItems.productId],
      references: [products.id],
    }),
    saleDetails: many(saleDetails),
    inventoryMovements: many(inventoryMovements),
    reservations: many(reservations),
    layawayDetails: many(layawayDetails),
    purchaseDetails: many(purchaseDetails),
  }),
);

// --- RELACIONES NUEVAS: Clientes y Apartados ---
export const customersRelations = relations(customers, ({ many }) => ({
  layaways: many(layaways),
}));

export const layawaysRelations = relations(layaways, ({ one, many }) => ({
  customer: one(customers, {
    fields: [layaways.customerId],
    references: [customers.id],
  }),
  layawayDetails: many(layawayDetails),
}));

export const layawayDetailsRelations = relations(layawayDetails, ({ one }) => ({
  layaway: one(layaways, {
    fields: [layawayDetails.layawayId],
    references: [layaways.id],
  }),
  product: one(products, {
    fields: [layawayDetails.productId],
    references: [products.id],
  }),
  productItem: one(productItems, {
    fields: [layawayDetails.productItemId],
    references: [productItems.id],
  }),
}));

export const inventoryMovementsRelations = relations(
  inventoryMovements,
  ({ one }) => ({
    product: one(products, {
      fields: [inventoryMovements.productId],
      references: [products.id],
    }),
    productItem: one(productItems, {
      fields: [inventoryMovements.productItemId],
      references: [productItems.id],
    }),
  }),
);

export const reservationsRelations = relations(reservations, ({ one }) => ({
  productItem: one(productItems, {
    fields: [reservations.productItemId],
    references: [productItems.id],
  }),
}));

export const salesRelations = relations(sales, ({ many }) => ({
  saleDetails: many(saleDetails),
}));

export const saleDetailsRelations = relations(saleDetails, ({ one }) => ({
  sale: one(sales, {
    fields: [saleDetails.saleId],
    references: [sales.id],
  }),
  product: one(products, {
    fields: [saleDetails.productId],
    references: [products.id],
  }),
  productItem: one(productItems, {
    fields: [saleDetails.productItemId],
    references: [productItems.id],
  }),
}));

export const expenseCategoriesRelations = relations(
  expenseCategories,
  ({ many }) => ({
    expenses: many(expenses),
  }),
);

export const expensesRelations = relations(expenses, ({ one }) => ({
  category: one(expenseCategories, {
    fields: [expenses.categoryId],
    references: [expenseCategories.id],
  }),
  relatedProductItem: one(productItems, {
    fields: [expenses.relatedProductItemId],
    references: [productItems.id],
  }),
  user: one(user, {
    fields: [expenses.userId],
    references: [user.id],
  }),
}));

export const importCostsRelations = relations(importCosts, ({ one }) => ({
  product: one(products, {
    fields: [importCosts.productId],
    references: [products.id],
  }),
  productItem: one(productItems, {
    fields: [importCosts.productItemId],
    references: [productItems.id],
  }),
  user: one(user, {
    fields: [importCosts.userId],
    references: [user.id],
  }),
}));

// --- Cash Flow Relations ---

// --- Purchases Relations ---
export const providersRelations = relations(providers, ({ many }) => ({
  purchases: many(purchases),
}));

export const purchasesRelations = relations(purchases, ({ one, many }) => ({
  provider: one(providers, {
    fields: [purchases.providerId],
    references: [providers.id],
  }),
  account: one(cashAccounts, {
    fields: [purchases.accountId],
    references: [cashAccounts.id],
  }),
  user: one(user, {
    fields: [purchases.userId],
    references: [user.id],
  }),
  purchaseDetails: many(purchaseDetails),
}));

export const purchaseDetailsRelations = relations(purchaseDetails, ({ one }) => ({
  purchase: one(purchases, {
    fields: [purchaseDetails.purchaseId],
    references: [purchases.id],
  }),
  product: one(products, {
    fields: [purchaseDetails.productId],
    references: [products.id],
  }),
  productItem: one(productItems, {
    fields: [purchaseDetails.productItemId],
    references: [productItems.id],
  }),
}));

export const cashAccountsRelations = relations(cashAccounts, ({ many }) => ({
  movements: many(cashMovements),
  transfersFrom: many(cashTransfers, { relationName: "transferFrom" }),
  transfersTo: many(cashTransfers, { relationName: "transferTo" }),
  reconciliations: many(cashReconciliations),
  purchases: many(purchases),
}));

export const cashMovementsRelations = relations(cashMovements, ({ one }) => ({
  account: one(cashAccounts, {
    fields: [cashMovements.accountId],
    references: [cashAccounts.id],
  }),
  createdByUser: one(user, {
    fields: [cashMovements.createdBy],
    references: [user.id],
  }),
}));

export const cashTransfersRelations = relations(cashTransfers, ({ one }) => ({
  fromAccount: one(cashAccounts, {
    fields: [cashTransfers.fromAccountId],
    references: [cashAccounts.id],
    relationName: "transferFrom",
  }),
  toAccount: one(cashAccounts, {
    fields: [cashTransfers.toAccountId],
    references: [cashAccounts.id],
    relationName: "transferTo",
  }),
  createdByUser: one(user, {
    fields: [cashTransfers.createdBy],
    references: [user.id],
  }),
}));

export const cashReconciliationsRelations = relations(cashReconciliations, ({ one }) => ({
  account: one(cashAccounts, {
    fields: [cashReconciliations.accountId],
    references: [cashAccounts.id],
  }),
  closedByUser: one(user, {
    fields: [cashReconciliations.closedBy],
    references: [user.id],
  }),
}));

export const shareholdersRelations = relations(shareholders, ({ many }) => ({
  distributionItems: many(shareholderDistributionItems),
}));

export const shareholderDistributionsRelations = relations(
  shareholderDistributions,
  ({ many }) => ({
    items: many(shareholderDistributionItems),
  }),
);

export const shareholderDistributionItemsRelations = relations(
  shareholderDistributionItems,
  ({ one }) => ({
    distribution: one(shareholderDistributions, {
      fields: [shareholderDistributionItems.distributionId],
      references: [shareholderDistributions.id],
    }),
    shareholder: one(shareholders, {
      fields: [shareholderDistributionItems.shareholderId],
      references: [shareholders.id],
    }),
  }),
);

