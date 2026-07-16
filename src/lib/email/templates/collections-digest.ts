/**
 * collections-digest.ts — Template HTML del correo diario de cobros.
 * Un solo correo consolidado con 3 tablas: vencen hoy, en mora, por vencer.
 */

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { rowKey, type CollectionRow, type DailyCollections } from "@/services/collections-digest-service";

const formatCOP = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const tipoLabel = (row: CollectionRow) => (row.tipo === "credito" ? "Crédito" : "Apartado");
const cuotaLabel = (row: CollectionRow) => (row.cuotaNumero != null ? `#${row.cuotaNumero}` : "—");

function renderRows(rows: CollectionRow[], showMora: boolean, moraMessages?: Map<string, string>): string {
  return rows
    .map(
      (r) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${r.clienteNombre}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${r.clienteTelefono ?? "—"}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${tipoLabel(r)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${cuotaLabel(r)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${formatCOP(r.monto)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${format(r.fecha, "d 'de' MMMM", { locale: es })}</td>
          ${showMora ? `<td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#b91c1c;font-weight:600;">${r.diasMora} días</td>` : ""}
        </tr>
        ${
          moraMessages?.get(rowKey(r))
            ? `<tr>
                <td colspan="${showMora ? 7 : 6}" style="padding:0 8px 12px;border-bottom:1px solid #e5e7eb;color:#4b5563;font-size:12px;font-style:italic;">
                  💬 Sugerencia IA: "${moraMessages.get(rowKey(r))}"
                </td>
              </tr>`
            : ""
        }`
    )
    .join("");
}

function renderTable(
  title: string,
  rows: CollectionRow[],
  color: string,
  showMora: boolean,
  moraMessages?: Map<string, string>
): string {
  if (rows.length === 0) return "";
  const headers = ["Cliente", "Teléfono", "Tipo", "Cuota", "Monto", "Fecha"];
  if (showMora) headers.push("Días mora");

  return `
    <h2 style="font-size:16px;color:${color};margin:24px 0 8px;">${title} (${rows.length})</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr>
          ${headers.map((h) => `<th style="text-align:left;padding:8px;border-bottom:2px solid #d1d5db;color:#374151;">${h}</th>`).join("")}
        </tr>
      </thead>
      <tbody>${renderRows(rows, showMora, moraMessages)}</tbody>
    </table>`;
}

export interface DigestEmailExtras {
  /** Resumen ejecutivo generado por IA (null si no hay proveedor LLM o falló). */
  narrative?: string | null;
  /** Mensajes de cobro sugeridos por cliente en mora, keyed por rowKey(row). */
  moraMessages?: Map<string, string>;
}

export function renderCollectionsDigestEmail(
  collections: DailyCollections,
  refDate: Date,
  extras: DigestEmailExtras = {}
): string {
  const { vencenHoy, enMora, porVencer } = collections;
  const { narrative, moraMessages } = extras;
  const total = vencenHoy.length + enMora.length + porVencer.length;
  const fechaFmt = format(refDate, "EEEE d 'de' MMMM 'de' yyyy", { locale: es });

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#111827;max-width:720px;margin:0 auto;">
      <h1 style="font-size:20px;margin-bottom:4px;">Cobros del día</h1>
      <p style="color:#6b7280;margin-top:0;">${fechaFmt} · ${total} pendientes por gestionar</p>
      ${
        narrative
          ? `<p style="background:#f3f4f6;border-radius:8px;padding:12px 16px;color:#1f2937;font-size:13px;line-height:1.5;">${narrative}</p>`
          : ""
      }
      ${renderTable("Vencen hoy", vencenHoy, "#b45309", false)}
      ${renderTable("En mora", enMora, "#b91c1c", true, moraMessages)}
      ${renderTable(`Por vencer (próximos días)`, porVencer, "#1d4ed8", false)}
      ${total === 0 ? `<p style="color:#6b7280;">No hay cobros pendientes hoy.</p>` : ""}
      <p style="color:#9ca3af;font-size:11px;margin-top:32px;">Digest automático de NovaTech. No responder a este correo.</p>
    </div>`;
}
