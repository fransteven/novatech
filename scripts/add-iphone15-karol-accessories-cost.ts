import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db";
import { layawayDetails } from "../src/db/schema";
import { productItems } from "../src/db/schema/inventory";
import { cashMovements } from "../src/db/schema/cash";
import { createCashMovement } from "../src/services/cash-service";

// Crédito del iPhone 15 (Karol G Confirmaciones MacPollo): el equipo salió con
// cable de carga ($50.000) y vidrio templado ($3.000) comprados aparte. Se suman
// al costo congelado para que la utilidad al liquidar no quede inflada, y se
// registra la salida de caja que los pagó.
const LAYAWAY_ID = "e223bda8-7d45-4fed-9542-570e72abcbb2";
const PRODUCT_ITEM_ID = "eaa063e2-da8e-492f-87aa-ef3092834063";
const LULO_BANK_MIREYA_ID = "21f77703-1c72-4322-8e45-3a07519f431a";
const BASE_COST = 1_300_000;
const ACCESSORIES_COST = 53_000;
const NEW_COST = (BASE_COST + ACCESSORIES_COST).toFixed(2);

async function main() {
  await db.transaction(async (tx) => {
    const [detail] = await tx
      .select({ unitCost: layawayDetails.unitCost })
      .from(layawayDetails)
      .where(eq(layawayDetails.layawayId, LAYAWAY_ID));
    if (!detail) throw new Error("Detalle del crédito no encontrado");
    if (Number(detail.unitCost) !== BASE_COST) {
      throw new Error(`Costo inesperado ${detail.unitCost}; ¿ya se aplicó?`);
    }

    const existing = await tx
      .select({ id: cashMovements.id })
      .from(cashMovements)
      .where(
        and(
          eq(cashMovements.sourceId, LAYAWAY_ID),
          eq(cashMovements.sourceType, "adjustment"),
        ),
      );
    if (existing.length > 0) throw new Error("La salida de caja ya existe");

    await tx
      .update(layawayDetails)
      .set({ unitCost: NEW_COST })
      .where(eq(layawayDetails.layawayId, LAYAWAY_ID));

    await tx
      .update(productItems)
      .set({ unitCost: NEW_COST })
      .where(eq(productItems.id, PRODUCT_ITEM_ID));

    const movement = await createCashMovement(
      {
        accountId: LULO_BANK_MIREYA_ID,
        direction: "out",
        amount: ACCESSORIES_COST,
        sourceType: "adjustment",
        sourceId: LAYAWAY_ID,
        paymentMethod: "transfer",
        notes:
          "Cable de carga ($50.000) + vidrio templado ($3.000) entregados con iPhone 15 a crédito (Karol G Confirmaciones MacPollo). Incluidos en el costo del equipo.",
      },
      tx,
    );

    console.log(`Costo actualizado a ${NEW_COST}; movimiento ${movement.id}`);
  });
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
