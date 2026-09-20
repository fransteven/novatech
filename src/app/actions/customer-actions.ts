"use server";

import {
  createCustomer,
  searchCustomers,
  getCustomerById,
  updateCustomer,
} from "@/services/customer-service";
import { customerSchema } from "@/lib/validators/customer-validator";

export async function createCustomerAction(data: unknown) {
  const validation = customerSchema.safeParse(data);
  
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message };
  }

  try {
    const customer = await createCustomer(validation.data);
    return { success: true, data: customer };
  } catch (error) {
    // Si la cédula/documentId ya existe, Drizzle lanzará un error de constraint (unique)
    const dbError = error as { code?: string };
    if (dbError.code === '23505') {
      return { success: false, error: "Ya existe un cliente con ese documento." };
    }
    console.error("Error creating customer:", error);
    return { success: false, error: "Error al crear el cliente." };
  }
}

export async function searchCustomersAction(query: string) {
  if (!query || query.length < 2) return { success: true, data: [] };
  
  try {
    const customers = await searchCustomers(query);
    return { success: true, data: customers };
  } catch (error) {
    console.error("Error searching customers:", error);
    return { success: false, error: "Error al buscar clientes." };
  }
}

export async function getCustomerAction(id: string) {
  try {
    const customer = await getCustomerById(id);
    return { success: true, data: customer };
  } catch (error) {
    console.error("Error getting customer:", error);
    return { success: false, error: "Error al obtener cliente." };
  }
}

export async function updateCustomerAction(id: string, data: unknown) {
  const partialSchema = customerSchema.partial();
  const validation = partialSchema.safeParse(data);

  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message };
  }

  try {
    const customer = await updateCustomer(id, validation.data);
    if (!customer) {
      return { success: false, error: "Cliente no encontrado." };
    }
    return { success: true, data: customer };
  } catch (error) {
    const dbError = error as { code?: string };
    if (dbError.code === "23505") {
      return {
        success: false,
        error: "Ya existe un cliente con ese documento.",
      };
    }
    console.error("Error updating customer:", error);
    return { success: false, error: "Error al actualizar el cliente." };
  }
}
