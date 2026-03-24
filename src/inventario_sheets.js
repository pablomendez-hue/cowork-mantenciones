const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID;
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL;
const SHEET_NAME = "Inventario";
const RANGE = SHEET_NAME + "!A:H";

// Row: id | sede | proveedor | producto | fecha | cantidad | tipo | registrado_por
function rowToRecord(row) {
  return {
    id: row[0] || "",
    sede: row[1] || "",
    proveedor: row[2] || "",
    producto: row[3] || "",
    fecha: row[4] || "",
    cantidad: row[5] !== "" && row[5] != null ? parseFloat(row[5]) : null,
    tipo: row[6] || "stock",
    registrado_por: row[7] || "",
  };
}

function recordToRow(r) {
  return [r.id, r.sede, r.proveedor, r.producto, r.fecha, r.cantidad ?? "", r.tipo, r.registrado_por];
}

export async function fetchInventario() {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Sheets API error: " + res.status);
  const data = await res.json();
  const rows = data.values || [];
  if (rows.length <= 1) return [];
  return rows.slice(1).map(rowToRecord).filter(r => r.id && r.sede);
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
  return callAppsScript("createBatch", { rows });
}

export async function updateInventarioRecord(record) {
  return callAppsScript("update", { id: record.id, row: recordToRow(record) });
}

export async function deleteInventarioRecord(id) {
  return callAppsScript("delete", { id });
}
