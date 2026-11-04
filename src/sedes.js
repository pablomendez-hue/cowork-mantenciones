export const RETIRED_SEDES = [
  "Liquidos",
  "Florida Center",
  "Isidora",
  "Los Militares - NACE",
  "Manuel Montt",
  "Tobalaba-P3",
];

function sedeKey(sede) {
  return String(sede || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const RETIRED_SEDE_KEYS = new Set(RETIRED_SEDES.map(sedeKey));

export function isRetiredSede(sede) {
  return RETIRED_SEDE_KEYS.has(sedeKey(sede));
}

// Keep historical rows in Sheets readable after a sede is renamed.
export function canonicalSede(sede) {
  return sede === "Monjitas" ? "Nido 9" : sede;
}

export function canonicalSedeKey(key) {
  return key.startsWith("Monjitas||") ? `Nido 9${key.slice("Monjitas".length)}` : key;
}
