/**
 * Normalización y validación de seriales/IMEI.
 *
 * Un serial es la identidad física de un equipo: se guarda siempre en la misma
 * forma canónica (sin espacios, en mayúsculas) para que la comparación contra
 * el inventario existente sea confiable y el índice único de
 * `product_items.serial_number` no se pueda burlar con espacios o minúsculas.
 */

export const normalizeSerial = (serial: string): string =>
  serial.trim().replace(/\s+/g, "").toUpperCase();

/**
 * Clave de BÚSQUEDA de un serial: además de espacios quita guiones, porque el
 * cliente dicta el IMEI en bloques ("352 099-00 1761481") y el escáner a veces
 * los inserta. Se aplica a AMBOS lados de la comparación (dato y query), nunca
 * para escribir en la base — para eso está `normalizeSerial`.
 */
export const serialSearchKey = (value: string): string =>
  value.replace(/[\s-]/g, "").toUpperCase();

/** Devuelve los seriales que aparecen más de una vez en el lote, ya normalizados. */
export const findDuplicateSerials = (serials: string[]): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const raw of serials) {
    const serial = normalizeSerial(raw);
    if (!serial) continue;
    if (seen.has(serial)) {
      duplicates.add(serial);
    }
    seen.add(serial);
  }

  return [...duplicates];
};
