/*
 * ══════════════════════════════════════════════════════════════
 *  Google Sheets API Service
 *  
 *  Connects to your Google Sheet as a backend database.
 *  
 *  SETUP INSTRUCTIONS:
 *  1. Go to https://console.cloud.google.com
 *  2. Create a new project (or use existing)
 *  3. Enable "Google Sheets API"
 *  4. Create credentials → API Key
 *  5. Also create a Service Account:
 *     - Go to Credentials → Create Credentials → Service Account
 *     - Give it a name like "cowork-mantenciones"
 *     - Download the JSON key file
 *     - Copy the service account email (looks like: name@project.iam.gserviceaccount.com)
 *  6. Share your Google Sheet with the service account email (Editor access)
 *  7. Put API Key in .env as VITE_GOOGLE_API_KEY
 *  8. Put Sheet ID in .env as VITE_GOOGLE_SHEET_ID
 *  
 *  For WRITE operations we use a lightweight Google Apps Script
 *  deployed as a web app (avoids needing OAuth in the frontend).
 *  See SETUP_GUIDE.md for the Apps Script code.
 * ══════════════════════════════════════════════════════════════
 */

const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID;
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL;

const SHEET_NAME = "Tickets";
const RANGE = `${SHEET_NAME}!A:P`;

/* ── Column mapping (must match your Google Sheet headers) ── */
// A=id | B=category | C=desc | D=sede | E=priority | F=stage 
// G=by | H=date | I=provider | J=amount | K=payment | L=closedAt
// M=comments (JSON string)

function rowToItem(row) {
  return {
    id: parseInt(row[0]) || Date.now(),
    category: row[1] || "",
    desc: row[2] || "",
    sede: row[3] || "",
    priority: row[4] || "Media",
    stage: row[5] || "requerimiento",
    by: row[6] || "",
    date: row[7] || "",
    provider: row[8] || null,
    amount: row[9] ? parseInt(row[9]) : null,
    payment: row[10] || null,
    closedAt: row[11] || null,
    comments: row[12] ? JSON.parse(row[12]) : [],
  };
}

function itemToRow(item) {
  return [
    item.id,
    item.category,
    item.desc,
    item.sede,
    item.priority,
    item.stage,
    item.by,
    item.date,
    item.provider || "",
    item.amount || "",
    item.payment || "",
    item.closedAt || "",
    JSON.stringify(item.comments || []),
  ];
}

/* ── READ: Fetch all tickets from the sheet ── */
export async function fetchAllTickets() {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheets API error: ${res.status}`);

  const data = await res.json();
  const rows = data.values || [];

  // Skip header row
  if (rows.length <= 1) return [];

  return rows.slice(1).map(rowToItem).filter((item) => item.id && item.desc);
}

/* ── WRITE: All write operations go through Apps Script ── */
async function callAppsScript(action, payload) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ action, ...payload }),
  });

  if (!res.ok) throw new Error(`Apps Script error: ${res.status}`);
  return res.json();
}

/* ── CREATE: Add a new ticket ── */
export async function createTicket(item) {
  return callAppsScript("create", { row: itemToRow(item) });
}

/* ── UPDATE: Update a ticket by ID ── */
export async function updateTicket(item) {
  return callAppsScript("update", { id: item.id, row: itemToRow(item) });
}

/* ── DELETE: Remove a ticket by ID (optional, for future use) ── */
export async function deleteTicket(id) {
  return callAppsScript("delete", { id });
}

/* ── Connection test ── */
export async function testConnection() {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}!A1:A1?key=${API_KEY}`;
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}

/* ── Check if configured ── */
export function isConfigured() {
  return !!(SHEET_ID && API_KEY && APPS_SCRIPT_URL);
}
