import { QUOTE_RECIPIENTS, pendingQuoteTickets, buildReminderBody } from "./_quote-reminder.js";

const SHEET_RANGE = "Tickets!A:P";
const DEFAULT_BASE_URL = "https://cowork-mantenciones.vercel.app";

export default async function handler(request, response) {
  if (request.method !== "GET") return response.status(405).json({ error: "Method not allowed" });
  if (!process.env.CRON_SECRET) return response.status(503).json({ error: "CRON_SECRET is not configured" });
  if (request.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return response.status(401).json({ error: "Unauthorized" });

  const sheetId = process.env.VITE_GOOGLE_SHEET_ID;
  const apiKey = process.env.VITE_GOOGLE_API_KEY;
  const appsScriptUrl = process.env.VITE_APPS_SCRIPT_URL;
  if (!sheetId || !apiKey || !appsScriptUrl) return response.status(503).json({ error: "Google Sheets configuration is incomplete" });

  try {
    const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(SHEET_RANGE)}?key=${apiKey}`;
    const sheetResponse = await fetch(sheetUrl);
    if (!sheetResponse.ok) throw new Error(`Sheets API error: ${sheetResponse.status}`);
    const data = await sheetResponse.json();
    const tickets = pendingQuoteTickets(data.values || []);
    if (!tickets.length) return response.status(200).json({ ok: true, sent: false, pending: 0 });

    const baseUrl = (process.env.APP_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
    const notifyResponse = await fetch(appsScriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        action: "notify",
        emails: QUOTE_RECIPIENTS,
        subject: `[Mantenciones] ${tickets.length} ticket${tickets.length === 1 ? "" : "s"} sin cotización`,
        body: buildReminderBody(tickets, baseUrl),
      }),
    });
    if (!notifyResponse.ok) throw new Error(`Apps Script error: ${notifyResponse.status}`);
    const result = await notifyResponse.json();
    if (result.success === false) throw new Error(result.error || "Apps Script notification failed");
    return response.status(200).json({ ok: true, sent: true, pending: tickets.length });
  } catch (error) {
    console.error("Weekly quote reminder:", error);
    return response.status(500).json({ error: "Could not send weekly quote reminder" });
  }
}
