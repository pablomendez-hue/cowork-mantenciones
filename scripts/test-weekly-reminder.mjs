import assert from "node:assert/strict";
import { pendingQuoteTickets, buildReminderBody } from "../api/_quote-reminder.js";
import weeklyQuoteReminder from "../api/weekly-quote-reminder.js";

const rows = [
  ["id", "num", "category", "desc", "sede", "priority", "stage", "by", "date", "provider", "amount"],
  [1, 7, "Mantención", "Filtración", "Abedules", "Alta", "requerimiento", "Marlin Garcia", "2026-08-03", "", ""],
  [2, 8, "Mantención", "Puerta", "Suecia", "Media", "requerimiento", "Ana Rondon", "15/08/2026", "Proveedor SPA", ""],
  [3, 9, "Mantención", "Luz", "Monjitas", "Baja", "requerimiento", "Vito Lacasella", "2026-07-31", "", ""],
  [4, 10, "Mantención", "Pintura", "Isidora", "Baja", "pago", "Ana Rondon", "2026-08-20", "Pinturas SPA", "150000"],
];

const pending = pendingQuoteTickets(rows);
assert.deepEqual(pending.map(ticket => ticket.id), [1, 2]);
const body = buildReminderBody(pending, "https://cowork-mantenciones.vercel.app");
assert.match(body, /Marlin Garcia/);
assert.match(body, /Pendiente: proveedor y precio/);
assert.match(body, /\?ticket=2/);

process.env.CRON_SECRET = "test-secret";
let statusCode = 0;
let responseBody = null;
const response = {
  status(code) { statusCode = code; return this; },
  json(value) { responseBody = value; return this; },
};
await weeklyQuoteReminder({ method:"GET", headers:{ authorization:"Bearer wrong-secret" } }, response);
assert.equal(statusCode, 401);
assert.deepEqual(responseBody, { error:"Unauthorized" });
console.log("Weekly quote reminder tests passed");
