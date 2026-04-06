// Config sheet: tipo | clave | valor | updated_at
// Stores sede assignments and user role overrides synced across all devices.

const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID;
const API_KEY  = import.meta.env.VITE_GOOGLE_API_KEY;
const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL;
const SHEET_NAME = "Config";
const RANGE = SHEET_NAME + "!A:D";

// ── Read all config from Sheets ───────────────────────────────────────────────
export async function fetchConfig() {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Config fetch error: " + res.status);
  const data = await res.json();
  const rows = (data.values || []).slice(1); // skip header
  return rows.map(r => ({
    tipo:       r[0] || "",
    clave:      r[1] || "",
    valor:      r[2] || "",
    updated_at: r[3] || "",
  }));
}

// ── Write / upsert one config entry ──────────────────────────────────────────
export async function upsertConfig(tipo, clave, valor) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ action: "upsertConfig", tipo, clave, valor }),
  });
  if (!res.ok) throw new Error("upsertConfig error: " + res.status);
  return res.json();
}

// ── Parse helpers ─────────────────────────────────────────────────────────────

// Returns { [email]: sede }
export function parseSedeCM(configRows) {
  const map = {};
  for (const r of configRows) {
    if (r.tipo === "sede_cm" && r.clave) map[r.clave.toLowerCase()] = r.valor || null;
  }
  return map;
}

// Returns extra users added via UI: [{name, email, role}]
export function parseExtraUsers(configRows) {
  const users = [];
  for (const r of configRows) {
    if (r.tipo === "user_extra" && r.clave && r.valor && r.valor !== "deleted") {
      try {
        const u = JSON.parse(r.valor);
        if (u.name && u.role) users.push({ name: u.name, email: r.clave, role: u.role });
      } catch {}
    }
  }
  return users;
}

// Returns { [email]: role } — role overrides for base users
export function parseRoleOverrides(configRows) {
  const map = {};
  for (const r of configRows) {
    if (r.tipo === "user_role" && r.clave && r.valor) map[r.clave.toLowerCase()] = r.valor;
  }
  return map;
}

// Returns { [producto]: categoria }
export function parseProdCat(configRows) {
  const map = {};
  for (const r of configRows) {
    if (r.tipo === "prod_cat" && r.clave && r.valor) map[r.clave] = r.valor;
  }
  return map;
}

// Returns { ["sede||producto"]: number }
export function parseBreakeven(configRows) {
  const map = {};
  for (const r of configRows) {
    if (r.tipo === "breakeven" && r.clave && r.valor) {
      const val = parseFloat(r.valor);
      if (!isNaN(val)) map[r.clave] = val;
    }
  }
  return map;
}

// Returns [{producto, categoria, proveedor, min_stock}] for products added via UI
export function parseProdGlobal(configRows) {
  const out = [];
  for (const r of configRows) {
    if (r.tipo === "prod_global" && r.clave && r.valor && r.valor !== "deleted") {
      try {
        const d = JSON.parse(r.valor);
        out.push({ producto: r.clave, categoria: d.categoria||"Aseo", proveedor: d.proveedor||"Aseo", min_stock: d.min_stock||1 });
      } catch {}
    }
  }
  return out;
}
