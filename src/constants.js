export const COLUMNS = [
  { id: "requerimiento", label: "Requerimiento", icon: "📋", sub: "Nuevos ingresos" },
  { id: "pago", label: "Pago", icon: "🏦", sub: "Aprobación finanzas" },
  { id: "en_proceso", label: "En Proceso", icon: "⚡", sub: "En ejecución" },
  { id: "finalizado", label: "Finalizado", icon: "✅", sub: "Cerrados" },
];

export const COL_IDS = COLUMNS.map((c) => c.id);

export const CATEGORIES = {
  Mantención: { color: "#f97316", bg: "#fff7ed", border: "#fed7aa" },
  "Servicio Adicional": { color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe" },
  "Aire Acondicionado": { color: "#8b5cf6", bg: "#f5f3ff", border: "#ddd6fe" },
};

export const PRIORITY = {
  Baja: { color: "#a3a3a3", dot: "#d4d4d4" },
  Media: { color: "#d97706", dot: "#f59e0b" },
  Alta: { color: "#ea580c", dot: "#f97316" },
  Urgente: { color: "#dc2626", dot: "#ef4444" },
};

export const SEDES = [
  "Abedules", "Alto el Golf", "Apoquindo", "BCI-1 Kennedy", "Cencosud-1",
  "Cerro el Plomo", "Fundación Chile", "Holanda", "Londres",
  "Los Militares - NACE", "Manuel Montt", "Monjitas", "MUT",
  "Neohaus", "Nueva Las Condes", "Plaza Egaña", "Principe de Gales",
  "Rosario Norte", "S2GO", "SalesForce", "San Sebastian - MACH",
  "Santa Lucia", "Suecia", "Tobalaba-P3", "Vespucio",
];

export const fmt = (n) => (n == null ? "—" : "$" + n.toLocaleString("es-CL"));

export const fdate = (d) => {
  if (!d) return "";
  const dt = new Date(d + "T12:00:00");
  return dt.toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
};

export const daysAgo = (d) => {
  if (!d) return 0;
  return Math.floor((new Date() - new Date(d + "T12:00:00")) / 86400000);
};

export const today = () => new Date().toISOString().split("T")[0];
