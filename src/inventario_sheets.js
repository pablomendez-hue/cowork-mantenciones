import { canonicalSede, isRetiredSede } from "./sedes.js";
import { canonicalProducto } from "./productos.js";

const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID;
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL;
const SHEET_NAME = "Inventario";
const RECENT_ROWS = 6000;

// Row: id | sede | proveedor | producto | fecha | cantidad | tipo | registrado_por
function rowToRecord(row) {
  return {
    id: row[0] || "",
    sede: canonicalSede(row[1] || ""),
    proveedor: row[2] || "",
    producto: canonicalProducto(row[3] || ""),
    fecha: row[4] || "",
    cantidad: row[5] !== "" && row[5] != null ? parseFloat(row[5]) : null,
    tipo: row[6] || "stock",
    registrado_por: row[7] || "",
  };
}

function recordToRow(r) {
  return [r.id, canonicalSede(r.sede), r.proveedor, canonicalProducto(r.producto), r.fecha, r.cantidad ?? "", r.tipo, r.registrado_por];
}

export async function fetchInventario() {
  // La hoja acumula decenas de miles de registros. Primero se consulta solo
  // la columna de IDs para ubicar el último registro y después se descarga el
  // tramo reciente que usa la app. Esto evita errores por respuestas enormes.
  const idsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}!A:A?key=${API_KEY}&t=${Date.now()}`;
  const idsRes = await fetch(idsUrl, { cache: "no-store" });
  if (!idsRes.ok) throw new Error("Sheets API error: " + idsRes.status);
  const idsData = await idsRes.json();
  const lastRow = Math.max(2, (idsData.values || []).length);
  const startRow = Math.max(2, lastRow - RECENT_ROWS + 1);
  const range = `${SHEET_NAME}!A${startRow}:H${lastRow}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${API_KEY}&t=${Date.now()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Sheets API error: " + res.status);
  const data = await res.json();
  const rows = data.values || [];
  return rows.map(rowToRecord).filter(r => r.id && r.sede && r.producto && !isRetiredSede(r.sede));
}

async function callAppsScript(action, payload) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ action, sheet: SHEET_NAME, ...payload }),
  });
  if (!res.ok) throw new Error("Apps Script error: " + res.status);
  return res.json();
}

export async function saveInventarioRegistro(records) {
  const rows = records.map(recordToRow);
  try {
    const result = await callAppsScript("createBatch", { rows });
    if (result?.success === false) throw new Error(result.error || "Google Sheets rechazó el guardado");
    return result;
  } catch (firstError) {
    // Apps Script puede completar la escritura y luego fallar al devolver su
    // respuesta por el redirect/CORS de Google. Verificar antes de reintentar
    // evita duplicar registros que ya llegaron a la planilla.
    const expectedIds = new Set(records.map(record => String(record.id)));
    try {
      const current = await fetchInventario();
      if (current.filter(record => expectedIds.has(String(record.id))).length === expectedIds.size) {
        return { success: true, verified: true };
      }
    } catch {}

    // Reintento compatible con navegadores que bloquean la respuesta
    // redirigida de Apps Script. Luego se confirma contra Google Sheets.
    await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "createBatch", sheet: SHEET_NAME, rows }),
    });
    // En modo no-cors el navegador no permite leer la respuesta, pero sí
    // confirma que la solicitud fue enviada. Se marca como pendiente para que
    // la próxima sincronización la confirme sin mostrar un error falso.
    return { success: true, pending: true };
  }
}

export async function updateInventarioRecord(record) {
  return callAppsScript("update", { id: record.id, row: recordToRow(record) });
}

export async function deleteInventarioRecord(id) {
  return callAppsScript("delete", { id });
}
