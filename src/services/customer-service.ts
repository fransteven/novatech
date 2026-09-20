import { db } from "@/db";
import { customers } from "@/db/schema";
import { eq, or, ilike } from "drizzle-orm";
import { CustomerInput } from "@/lib/validators/customer-validator";

export const createCustomer = async (data: CustomerInput) => {
  const [newCustomer] = await db
    .insert(customers)
    .values({
      documentId: data.documentId,
      name: data.name,
      phone: data.phone || null,
      email: data.email || null,
    })
    .returning();

  return newCustomer;
};

export const searchCustomers = async (query: string) => {
  const cleanQuery = query.trim();
  
  return await db
    .select()
    .from(customers)
    .where(
      or(
        ilike(customers.name, `%${cleanQuery}%`),
        ilike(customers.documentId, `%${cleanQuery}%`)
      )
    )
    .limit(10);
};

export const getCustomerById = async (id: string) => {
  const result = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1);
    
  return result[0] || null;
};

export const updateCustomer = async (
  id: string,
  data: Partial<CustomerInput>,
) => {
  const [updated] = await db
    .update(customers)
    .set({
      ...(data.documentId !== undefined && { documentId: data.documentId }),
      ...(data.name !== undefined && { name: data.name }),
      ...(data.phone !== undefined && { phone: data.phone || null }),
      ...(data.email !== undefined && { email: data.email || null }),
    })
    .where(eq(customers.id, id))
    .returning();

  return updated || null;
};
