/** Formato de fecha compartido por toda la UI de garantías. */
export const formatWarrantyDate = (date: Date | string | null): string => {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

/**
 * N° visible de venta/apartado. La tabla `sales` no tiene consecutivo, así que
 * se usa el prefijo del UUID — que es justamente lo que el usuario puede pegar
 * de vuelta en el buscador.
 */
export const formatDocumentNumber = (id: string): string =>
  `#${id.slice(0, 8).toUpperCase()}`;
