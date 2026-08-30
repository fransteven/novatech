"use server";

import { revalidatePath } from "next/cache";
import { productSchema } from "@/lib/validators/product-validator";
import * as productService from "@/services/product-service";
import * as categoryService from "@/services/category-service";

export async function createProductAction(data: unknown) {
  const result = productSchema.safeParse(data);

  if (!result.success) {
    return { success: false, error: result.error.issues[0].message };
  }

  try {
    // 1. Get Category Name
    let categoryName = "GEN";
    if (result.data.categoryId) {
      const category = await categoryService.getCategoryById(
        result.data.categoryId,
      );
      if (category) {
        categoryName = category.name;
      }
    }

    // 2. Determinar el SKU final (Reciclado vs Autogenerado) e intentar inserción con reintentos
    const isCustomSku = result.data.sku && result.data.sku.trim() !== "";
    const maxAttempts = isCustomSku ? 1 : 5;
    let attempt = 0;
    let success = false;
    let created: Awaited<ReturnType<typeof productService.createProduct>> | null =
      null;

    while (attempt < maxAttempts && !success) {
      attempt++;
      let currentSKU = "";

      if (isCustomSku) {
        currentSKU = result.data.sku!.trim();
      } else {
        // Generar SKU interno si no se proporcionó código de barras
        const { generateBaseSKU } = await import("@/lib/utils");
        const baseSKU = generateBaseSKU(
          categoryName,
          result.data.name,
          result.data.attributes,
        );
        // Generamos un sufijo más fuerte (8 caracteres alfanuméricos)
        const suffix = (
          Math.random().toString(36).substring(2, 10).toUpperCase() +
          Math.random().toString(36).substring(2, 4).toUpperCase()
        ).substring(0, 8);
        currentSKU = `${baseSKU}-${suffix}`;
      }

      try {
        created = await productService.createProduct({
          ...result.data,
          sku: currentSKU,
        });
        success = true;
      } catch (err: any) {
        const isDuplicateSku =
          err.code === "23505" ||
          (err.message &&
            (err.message.toLowerCase().includes("duplicate key") ||
              err.message.toLowerCase().includes("unique constraint")));

        if (isDuplicateSku && attempt < maxAttempts) {
          continue; // Reintentar
        }
        throw err; // Lanzar al bloque catch general
      }
    }

    revalidatePath("/dashboard/catalog");
    revalidatePath("/catalog");
    revalidatePath("/purchases");
    revalidatePath("/inventory");
    // Se devuelve el producto creado para que quien lo cree al vuelo (ej. el
    // formulario de compras) pueda seleccionarlo sin recargar el catálogo.
    return { success: true, data: created };
  } catch (error: any) {
    console.error("Error creating product:", error);

    const isDuplicateSku =
      error.code === "23505" ||
      (error.message &&
        (error.message.toLowerCase().includes("duplicate key") ||
          error.message.toLowerCase().includes("unique constraint")));

    if (isDuplicateSku) {
      return { success: false, error: "SKU already exists, please retry" };
    }

    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to create product" };
  }
}

export async function updateProductAction(id: string, data: unknown) {
  const result = productSchema.partial().safeParse(data);

  if (!result.success) {
    return { success: false, error: result.error.issues[0].message };
  }

  try {
    const updated = await productService.updateProduct(id, result.data);
    if (!updated) return { success: false, error: "Product not found" };

    revalidatePath("/dashboard/catalog");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating product:", error);

    const isDuplicateSku =
      error.code === "23505" ||
      (error.message &&
        (error.message.toLowerCase().includes("duplicate key") ||
          error.message.toLowerCase().includes("unique constraint")));

    if (isDuplicateSku) {
      return { success: false, error: "Ya existe otro producto con el mismo código de barras (SKU)." };
    }

    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to update product" };
  }
}

export async function deleteProductAction(id: string) {
  try {
    const deleted = await productService.deleteProduct(id);
    if (!deleted) return { success: false, error: "Producto no encontrado" };

    revalidatePath("/dashboard/catalog");
    return { success: true, message: "Producto eliminado exitosamente" };
  } catch (error: any) {
    console.error("Error deleting product:", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Error interno al intentar eliminar el producto" };
  }
}

export async function getProductsAction() {
  try {
    const products = await productService.getProducts();
    return { success: true, data: products };
  } catch (error) {
    console.error("Error fetching products:", error);
    return { success: false, error: "Failed to fetch products" };
  }
}
