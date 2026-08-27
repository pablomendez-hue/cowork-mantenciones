export const QUOTE_RECIPIENTS = ["luis.morales@co-work.cl", "jesus.ubilla@co-work.cl"];
export const QUOTE_START_DATE = "2026-08-01";

export function normalizeDate(value) {
  const text = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (!match) return "";
  return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

export function pendingQuoteTickets(rows) {
  return rows.slice(1).map(row => ({
    id: Number(row[0]) || 0,
    num: Number(row[1]) || 0,
    category: row[2] || "",
    desc: row[3] || "",
    sede: row[4] || "",
    priority: row[5] || "",
    by: row[7] || "",
    date: normalizeDate(row[8]),
    provider: String(row[9] || "").trim(),
    amount: String(row[10] || "").trim(),
  })).filter(ticket => ticket.id && ticket.date >= QUOTE_START_DATE && (!ticket.provider || !ticket.amount));
}

export function buildReminderBody(tickets, baseUrl) {
  const intro = `Hay ${tickets.length} ticket${tickets.length === 1 ? "" : "s"} ingresado${tickets.length === 1 ? "" : "s"} desde el 1 de agosto de 2026 sin cotización completa (proveedor y/o precio).`;
  const details = tickets.map(ticket => {
    const number = `#${String(ticket.num).padStart(3, "0")}`;
    return [
      `${number} - ${ticket.desc}`,
      `Sede: ${ticket.sede}`,
      `Categoría: ${ticket.category}`,
      `Prioridad: ${ticket.priority}`,
      `Creado por: ${ticket.by}`,
      `Fecha: ${ticket.date}`,
      `Pendiente: ${!ticket.provider && !ticket.amount ? "proveedor y precio" : !ticket.provider ? "proveedor" : "precio"}`,
      `${baseUrl}/?ticket=${ticket.id}`,
    ].join("\n");
  }).join("\n\n");
  return `${intro}\n\n${details}\n\nPor favor ingresen a cada ticket y completen el nombre del proveedor y el precio.`;
}
