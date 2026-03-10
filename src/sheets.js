const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID;
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL;
const SHEET_NAME = "Tickets";
const RANGE = SHEET_NAME + "!A:P";

function rowToItem(row) {
  return {
    id: parseInt(row[0]) || Date.now(),
    num: parseInt(row[1]) || 0,
    category: row[2] || "",
    desc: row[3] || "",
    sede: row[4] || "",
    priority: row[5] || "Baja",
    stage: row[6] || "requerimiento",
    by: row[7] || "",
    date: row[8] || "",
    provider: row[9] || null,
    amount: row[10] ? parseInt(row[10]) : null,
    payment: row[11] || null,
    closedAt: row[12] || null,
    execDate: row[13] || null,
    comments: row[14] ? JSON.parse(row[14]) : [],
    assignee: row[15] || null,
  };
}
function itemToRow(item) {
  return [item.id, item.num||0, item.category, item.desc, item.sede, item.priority, item.stage, item.by, item.date, item.provider||"", item.amount||"", item.payment||"", item.closedAt||"", item.execDate||"", JSON.stringify(item.comments||[]), item.assignee||""];
}
export async function fetchAllTickets() {
  const url = "https://sheets.googleapis.com/v4/spreadsheets/"+SHEET_ID+"/values/"+RANGE+"?key="+API_KEY;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Sheets API error: "+res.status);
  const data = await res.json();
  const rows = data.values || [];
  if (rows.length <= 1) return [];
  return rows.slice(1).map(rowToItem).filter((item) => item.id && item.desc);
}
async function callAppsScript(action, payload) {
  const res = await fetch(APPS_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ action, ...payload }) });
  if (!res.ok) throw new Error("Apps Script error: "+res.status);
  return res.json();
}
export async function createTicket(item) { return callAppsScript("create", { row: itemToRow(item) }); }
export async function updateTicket(item) { return callAppsScript("update", { id: item.id, row: itemToRow(item) }); }
export async function deleteTicket(id) { return callAppsScript("delete", { id }); }
export async function sendNotification(emails, subject, body) { return callAppsScript("notify", { emails, subject, body }); }
export async function testConnection() { try { const url = "https://sheets.googleapis.com/v4/spreadsheets/"+SHEET_ID+"/values/"+SHEET_NAME+"!A1:A1?key="+API_KEY; const res = await fetch(url); return res.ok; } catch { return false; } }
export function isConfigured() { return !!(SHEET_ID && API_KEY && APPS_SCRIPT_URL); }
