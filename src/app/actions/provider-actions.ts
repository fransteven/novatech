"use server";

import { ProviderService } from "@/services/provider-service";
import { createProviderSchema } from "@/lib/validators/provider-validator";
import { revalidatePath } from "next/cache";

export async function createProviderAction(data: unknown) {
  try {
    const validatedData = createProviderSchema.parse(data);

    const provider = await ProviderService.createProvider(validatedData as any);

    revalidatePath("/purchases");
    return { success: true, data: provider };
  } catch (error: any) {
    console.error("Error creating provider:", error);
    if (error.name === "ZodError") {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: error.message || "Error al crear el proveedor" };
  }
}

export async function getProvidersAction(query?: string) {
  try {
    const providers = await ProviderService.getProviders(query);
    return { success: true, data: providers };
  } catch (error: any) {
    console.error("Error fetching providers:", error);
    return { success: false, error: "Error al cargar los proveedores" };
  }
}
