"use server";

import { ZodError } from "zod";
import { revalidatePath } from "next/cache";

import { ProviderService } from "@/services/provider-service";
import { createProviderSchema } from "@/lib/validators/provider-validator";

const toErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? fallback;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

export async function createProviderAction(data: unknown) {
  try {
    const validatedData = createProviderSchema.parse(data);

    const provider = await ProviderService.createProvider(validatedData);

    revalidatePath("/purchases");
    return { success: true as const, data: provider };
  } catch (error) {
    console.error("Error creating provider:", error);
    return {
      success: false as const,
      error: toErrorMessage(error, "Error al crear el proveedor"),
    };
  }
}

export async function getProvidersAction(query?: string) {
  try {
    const providers = await ProviderService.getProviders(query);
    return { success: true as const, data: providers };
  } catch (error) {
    console.error("Error fetching providers:", error);
    return {
      success: false as const,
      error: "Error al cargar los proveedores",
    };
  }
}
