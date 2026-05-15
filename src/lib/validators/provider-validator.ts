import { z } from "zod";

export const createProviderSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  phone: z.string().optional().nullable(),
  socialMedia: z.record(z.string(), z.string()).optional().nullable(),
  country: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type CreateProviderSchema = z.infer<typeof createProviderSchema>;
