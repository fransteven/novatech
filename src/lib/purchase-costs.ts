/**
 * Prorrateo de costos adicionales de una compra (flete, casillero, arancel,
 * comisión) sobre el costo unitario de cada línea — el "landed cost".
 *
 * Regla: cada línea recibe una porción proporcional a su valor de factura.
 * El reparto se hace en centavos con el método del mayor residuo, de modo que
 * la suma de lo asignado iguale exactamente el total de costos adicionales:
 * no se pierden ni se inventan pesos al redondear.
 *
 * Funciones puras y sin dependencias de BD para poder testearlas aisladas.
 */

export interface CostLineInput {
  quantity: number;
  unitCost: number;
}

export interface AllocatedCostLine {
  quantity: number;
  /** Costo de factura, tal como lo cobró el proveedor. */
  unitCost: number;
  /** quantity × unitCost */
  lineTotal: number;
  /** Porción de costos adicionales asignada a esta línea. */
  extraShare: number;
  /** lineTotal + extraShare */
  landedLineTotal: number;
  /**
   * Costo aterrizado unidad por unidad (longitud === quantity). Para líneas
   * serializadas cada product_item toma su propio valor; la suma iguala
   * exactamente landedLineTotal.
   */
  landedUnitCosts: number[];
  /**
   * Costo aterrizado representativo de la línea (landedLineTotal / quantity,
   * redondeado). Es el que usan las líneas NO serializadas, donde un único
   * movimiento de inventario cubre todas las unidades.
   */
  landedUnitCost: number;
}

export interface AllocationResult {
  subtotal: number;
  extraCostsAmount: number;
  total: number;
  lines: AllocatedCostLine[];
}

const toCents = (value: number): number => Math.round(value * 100);
const fromCents = (cents: number): number => Number((cents / 100).toFixed(2));

/**
 * Reparte `totalCents` entre los pesos `weights` de forma proporcional,
 * asignando los centavos sobrantes a los mayores residuos (y, en empate, a los
 * primeros). La suma del resultado siempre es exactamente `totalCents`.
 */
const distributeCents = (totalCents: number, weights: number[]): number[] => {
  const count = weights.length;
  if (count === 0) return [];

  const weightSum = weights.reduce((acc, w) => acc + w, 0);

  // Sin base sobre la cual prorratear (todo a costo cero): reparto parejo.
  if (weightSum <= 0) {
    const base = Math.floor(totalCents / count);
    const result = new Array<number>(count).fill(base);
    let remainder = totalCents - base * count;
    for (let i = 0; remainder > 0; i = (i + 1) % count, remainder--) {
      result[i] += 1;
    }
    return result;
  }

  const exact = weights.map((w) => (totalCents * w) / weightSum);
  const floors = exact.map((value) => Math.floor(value));
  let remainder = totalCents - floors.reduce((acc, value) => acc + value, 0);

  const order = exact
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index);

  for (let i = 0; i < order.length && remainder > 0; i++, remainder--) {
    floors[order[i].index] += 1;
  }

  return floors;
};

/**
 * Calcula subtotal, total y costo aterrizado por línea/unidad.
 * `extraCostsAmount` en 0 (o subtotal en 0) deja el costo de factura intacto.
 */
export const allocateExtraCosts = (
  lines: CostLineInput[],
  extraCostsAmount: number,
): AllocationResult => {
  const lineTotalsCents = lines.map((line) =>
    toCents(line.quantity * line.unitCost),
  );
  const subtotalCents = lineTotalsCents.reduce((acc, value) => acc + value, 0);
  const extraCents = Math.max(0, toCents(extraCostsAmount));

  const shares =
    extraCents > 0 && lines.length > 0
      ? distributeCents(extraCents, lineTotalsCents)
      : lines.map(() => 0);

  const allocated: AllocatedCostLine[] = lines.map((line, index) => {
    const lineTotalCents = lineTotalsCents[index];
    const landedLineTotalCents = lineTotalCents + shares[index];

    // Reparto interno entre las unidades de la línea: todas pesan igual.
    const perUnitCents = distributeCents(
      landedLineTotalCents,
      new Array<number>(Math.max(1, line.quantity)).fill(1),
    );

    return {
      quantity: line.quantity,
      unitCost: line.unitCost,
      lineTotal: fromCents(lineTotalCents),
      extraShare: fromCents(shares[index]),
      landedLineTotal: fromCents(landedLineTotalCents),
      landedUnitCosts: perUnitCents.map(fromCents),
      landedUnitCost: fromCents(
        Math.round(landedLineTotalCents / Math.max(1, line.quantity)),
      ),
    };
  });

  return {
    subtotal: fromCents(subtotalCents),
    extraCostsAmount: fromCents(extraCents),
    total: fromCents(subtotalCents + extraCents),
    lines: allocated,
  };
};

export type PurchasePaymentStatus = "paid" | "partial" | "pending";

/**
 * El estado de pago nunca se recibe del cliente: se deriva de lo abonado.
 * Se compara en centavos para no arrastrar errores de punto flotante.
 */
export const derivePaymentStatus = (
  amountPaid: number,
  total: number,
): PurchasePaymentStatus => {
  const paidCents = toCents(amountPaid);
  const totalCents = toCents(total);

  if (paidCents <= 0) return "pending";
  if (paidCents >= totalCents) return "paid";
  return "partial";
};
