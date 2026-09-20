import { NextResponse } from "next/server";
import { db } from "@/db";
import { products, productItems, categories } from "@/db/schema/inventory";
import { eq, and } from "drizzle-orm";

/**
 * API para Marketing - Inventario Comercializable
 * Expone productos disponibles para la generación de flyers publicitarios.
 * Protegido por API Key y filtrado para no exponer datos financieros sensibles.
 */
export async function GET(request: Request) {
  try {
    // 1. Validación de Seguridad (API Key)
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey || apiKey !== process.env.MARKETING_API_KEY) {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 401 }
      );
    }

    // 2. Consulta de Datos (Drizzle ORM)
    // Extraemos ítems disponibles, haciendo JOIN con su producto y categoría.
    // Solo seleccionamos campos no sensibles (comerciales).
    const rawInventory = await db
      .select({
        itemId: productItems.id,
        condition: productItems.condition,
        conditionDetails: productItems.conditionDetails,
        productName: products.name,
        productPrice: products.price,
        isSerialized: products.isSerialized,
        categoryName: categories.name,
        attributes: products.attributes,
      })
      .from(productItems)
      .innerJoin(products, eq(productItems.productId, products.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(productItems.status, "available"));

    // 3. Transformación y Agrupación (Data Shaping)
    // Agrupamos por producto para consolidar stock y condiciones.
    const groupedInventory = rawInventory.reduce((acc, curr) => {
      const key = curr.productName;

      if (!acc[key]) {
        acc[key] = {
          productName: curr.productName,
          category: curr.categoryName || "Sin Categoría",
          price: curr.productPrice,
          attributes: curr.attributes,
          totalAvailable: 0,
          availableUnits: [],
        };
      }

      acc[key].totalAvailable += 1;

      // Si es un producto serializado (ej: iPhone), incluimos detalles de condición física
      if (curr.isSerialized) {
        acc[key].availableUnits.push({
          unitId: curr.itemId, // ID interno (UUID), no expone IMEI/Serial real por seguridad
          // `condition` es la columna (new | used | refurbished);
          // `conditionDetails` son las métricas físicas (batería, etc.).
          condition: curr.condition,
          conditionDetails: curr.conditionDetails,
        });
      }

      return acc;
    }, {} as Record<string, any>);

    const responseData = Object.values(groupedInventory);

    // 4. Respuesta Estructurada
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: responseData.length,
      data: responseData,
    });
  } catch (error) {
    console.error("Marketing API Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
