// Keep historical rows in Sheets readable after a sede is renamed.
export function canonicalSede(sede) {
  return sede === "Monjitas" ? "Nido 9" : sede;
}

export function canonicalSedeKey(key) {
  return key.startsWith("Monjitas||") ? `Nido 9${key.slice("Monjitas".length)}` : key;
}
