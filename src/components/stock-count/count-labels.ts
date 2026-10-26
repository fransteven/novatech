import * as XLSX from "xlsx";
import { formatCurrency } from "@/lib/formatters";

export interface LabelLine {
  productName: string;
  productPrice: string | number;
  internalCode: string | null;
  quantity: number;
}

/**
 * Exporta las etiquetas de la mercancía sin código de fábrica en el mismo
 * formato que `print-labels-dialog` (Producto / Precio / Codigo) para la app de
 * NIIMBOT: una fila por unidad. Devuelve cuántas etiquetas se generaron.
 */
export const exportCountLabels = (lines: LabelLine[], countName: string): number => {
  const rows = lines
    .filter((line) => line.internalCode)
    .flatMap((line) =>
      Array.from({ length: line.quantity }, () => ({
        Producto: line.productName,
        Precio: formatCurrency(Number(line.productPrice)),
        Codigo: line.internalCode!,
      })),
    );
  if (rows.length === 0) return 0;

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Etiquetas NIIMBOT");
  const slug = countName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  XLSX.writeFile(workbook, `etiquetas_${slug || "conteo"}_${Date.now()}.xlsx`);
  return rows.length;
};
