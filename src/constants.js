export const COLUMNS = [
  { id: "requerimiento", label: "Requerimiento", icon: "\ud83d\udccb", sub: "Nuevos ingresos" },
  { id: "pago", label: "Pago", icon: "\ud83c\udfe6", sub: "Aprobaci\u00f3n finanzas" },
  { id: "en_proceso", label: "En Proceso", icon: "\u26a1", sub: "En ejecuci\u00f3n" },
  { id: "finalizado", label: "Finalizado", icon: "\u2705", sub: "Cerrados" },
];
export const COL_IDS = COLUMNS.map((c) => c.id);
export const CATEGORIES = {
  "Mantenci\u00f3n": { color: "#f97316", bg: "#fff7ed", border: "#fed7aa" },
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
  "Abedules","Alto el Golf","Apoquindo","BCI-1 Kennedy","Cencosud-1",
  "Cerro el Plomo","Fundaci\u00f3n Chile","Holanda","Isidora","Londres",
  "Los Militares - NACE","Manuel Montt","Monjitas","MUT",
  "Neohaus","Nueva Las Condes","Plaza Ega\u00f1a","Principe de Gales",
  "Rosario Norte","S2GO","Salesforce","San Sebastian - MACH",
  "Santa Lucia","Santa Rosa","Suecia","Tobalaba-P3","Vespucio",
];
export const USERS = [
  { name:"Luis Morales", email:"luis.morales@co-work.cl", role:"ops" },
  { name:"Ana Rondon", email:"ana@co-work.cl", role:"admin" },
  { name:"Vito Lacasella", email:"vito@co-work.cl", role:"admin" },
  { name:"Emilia Jorges", email:"emilia@co-work.cl", role:"admin" },
  { name:"Osaris Gomez", email:"osaris@co-work.cl", role:"ops" },
  { name:"Maria Fernanda", email:"maria.fernanda@co-work.cl", role:"admin" },
  { name:"Pablo Mendez", email:"pablo.mendez@coworklatam.com", role:"admin" },
  { name:"Mar\u00eda Ubilla", email:"maria.p@co-work.cl", role:"ops" },
  { name:"Sebastian O\u0027ryan", email:"sebastian.oryan@co-work.cl", role:"admin" },
  { name:"Aneley", email:"aneley@co-work.cl", role:"cm" },
  { name:"Eduardo Arias", email:"eduardo.arias@co-work.cl", role:"cm" },
  { name:"Diana Pabon", email:"diana.pabon@co-work.cl", role:"cm" },
  { name:"Oryady Diaz", email:"oryady.diaz@co-work.cl", role:"cm" },
  { name:"Jennifer Pachano", email:"jennifer.pachano@co-work.cl", role:"cm" },
  { name:"Albert Mendez", email:"albert.mendez@co-work.cl", role:"cm" },
  { name:"Erika Contreras", email:"erika.contreras@co-work.cl", role:"cm" },
  { name:"Sthella Lugo", email:"sthella.lugo@co-work.cl", role:"cm" },
  { name:"Ysabel Villarroel", email:"ysabel.villarroel@co-work.cl", role:"cm" },
  { name:"Yessica Alvarado", email:"yessica.alvarado@co-work.cl", role:"cm" },
  { name:"Milagros", email:"milagros@co-work.cl", role:"cm" },
  { name:"Yenire Vera", email:"yenire.vera@co-work.cl", role:"cm" },
  { name:"Maria Soares", email:"maria.soares@co-work.cl", role:"cm" },
  { name:"L. Olivares", email:"l.olivares@co-work.cl", role:"cm" },
  { name:"Jacqueline Pulgar", email:"jacqueline.pulgar@co-work.cl", role:"cm" },
  { name:"Luisana Pulido", email:"luisana.pulido@co-work.cl", role:"cm" },
  { name:"Milecsy Blanco", email:"milecsy.blanco@co-work.cl", role:"cm" },
  { name:"Lennis", email:"lennis@co-work.cl", role:"cm" },
  { name:"Armando Gutierrez", email:"armando.gutierrez@co-work.cl", role:"cm" },
  { name:"Jose Diaz", email:"jose.diaz@co-work.cl", role:"cm" },
  { name:"Maria Jesus Ubilla", email:"jesus.ubilla@co-work.cl", role:"ops" },
  { name:"Milagros Gonzalez", email:"milagros.gonzalez@co-work.cl", role:"cm" },
  { name:"Paula Aliste", email:"paula.aliste@co-work.cl", role:"cm" },
  { name:"Sonnie Rubio", email:"sonnie.rubio@co-work.cl", role:"cm" },
  { name:"Carlos Sanchez", email:"carlos.sanchez@co-work.cl", role:"ops" },
];
export const ROLE_LABELS = { cm: "Comercial", ops: "Operaciones", admin: "Administrador" };
export const ROLE_COLORS = { cm: "#3b82f6", ops: "#f97316", admin: "#8b5cf6" };
export const NOTIFY_EMAILS = { admin: ["maria.fernanda@co-work.cl","pablo.mendez@coworklatam.com","sebastian.oryan@co-work.cl"], ops: ["luis.morales@co-work.cl","osaris@co-work.cl","maria.p@co-work.cl"] };
export const fmt = (n) => (n == null ? "\u2014" : "$" + n.toLocaleString("es-CL"));
export const fdate = (d) => { if (!d) return ""; const dt = new Date(d + "T12:00:00"); return dt.toLocaleDateString("es-CL", { day: "2-digit", month: "short" }); };
export const daysAgo = (d) => { if (!d) return 0; return Math.floor((new Date() - new Date(d + "T12:00:00")) / 86400000); };
export const today = () => new Date().toISOString().split("T")[0];
