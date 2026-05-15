import { db } from "@/db";
import { providers } from "@/db/schema";
import { eq, ilike, or } from "drizzle-orm";

export interface CreateProviderInput {
  name: string;
  phone?: string | null;
  socialMedia?: Record<string, string> | null;
  country?: string | null;
  city?: string | null;
  location?: string | null;
  notes?: string | null;
}

export const ProviderService = {
  async createProvider(data: CreateProviderInput) {
    const [provider] = await db.insert(providers).values(data).returning();
    return provider;
  },

  async getProviders(query?: string) {
    if (query) {
      return await db
        .select()
        .from(providers)
        .where(or(ilike(providers.name, `%${query}%`), ilike(providers.phone, `%${query}%`)))
        .orderBy(providers.name);
    }
    return await db.select().from(providers).orderBy(providers.name);
  },

  async getProviderById(id: string) {
    const [provider] = await db
      .select()
      .from(providers)
      .where(eq(providers.id, id));
    return provider;
  },
};
